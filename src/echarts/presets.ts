import type { NormalizedEChartDefinition } from "./definition.ts";
import type { ChartOption } from "./registry.ts";
import {
  barChartOption,
  bollingerBandsChartOption,
  boxplotChartOption,
  candlestickWithVolumeOption,
  correlationHeatmapChartOption,
  depthChartOption,
  heatmapChartOption,
  histogramChartOption,
  lineChartOption,
  macdChartOption,
  ohlcChartOption,
  orderBookChartOption,
  pieChartOption,
  rsiChartOption,
  sankeyChartOption,
  scatterChartOption,
  treemapChartOption,
  type BarChartOptionArgs,
  type LineChartOptionArgs,
} from "./options.ts";

export const ECHART_PRESET_TYPES = [
  "line",
  "area",
  "bar",
  "pie",
  "donut",
  "rose",
  "scatter",
  "histogram",
  "heatmap",
  "correlation-heatmap",
  "treemap",
  "sankey",
  "boxplot",
  "candlestick-volume",
  "macd",
  "rsi",
  "bollinger-bands",
  "depth",
  "order-book",
  "ohlc",
  "option",
] as const;

export type EChartPresetType = (typeof ECHART_PRESET_TYPES)[number];

type JsonRecord = Record<string, unknown>;
type PresetBuilder = (definition: NormalizedEChartDefinition) => ChartOption;

const SUPPORTED_TYPES = new Set<string>(ECHART_PRESET_TYPES);

function fail(definition: NormalizedEChartDefinition, message: string): never {
  const id = definition.id ? ` "${definition.id}"` : "";
  throw new Error(`[echarts] ${definition.type}${id}: ${message}`);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(data: JsonRecord, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" ? value : undefined;
}

function getBoolean(data: JsonRecord, key: string): boolean | undefined {
  const value = data[key];
  return typeof value === "boolean" ? value : undefined;
}

function getNumber(data: JsonRecord, key: string): number | undefined {
  const value = data[key];
  return typeof value === "number" ? value : undefined;
}

function getRoseMode(
  definition: NormalizedEChartDefinition,
): boolean | "radius" | "area" | undefined {
  const value = definition.data.rose;
  if (value === undefined) return undefined;
  if (
    value === true ||
    value === false ||
    value === "radius" ||
    value === "area"
  ) {
    return value;
  }
  fail(definition, 'data.rose must be true, false, "radius", or "area".');
}

function stringArray(
  definition: NormalizedEChartDefinition,
  data: JsonRecord,
  key: string,
): string[] {
  const value = data[key];
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    fail(definition, `data.${key} must be an array of strings.`);
  }
  return value;
}

function categoryArray(
  definition: NormalizedEChartDefinition,
  data: JsonRecord,
  key: string,
): Array<string | number> {
  const value = data[key];
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string" || typeof item === "number")
  ) {
    fail(definition, `data.${key} must be an array of strings or numbers.`);
  }
  return value;
}

function numberArray(
  definition: NormalizedEChartDefinition,
  data: JsonRecord,
  key: string,
): number[] {
  const value = data[key];
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "number")
  ) {
    fail(definition, `data.${key} must be an array of numbers.`);
  }
  return value;
}

function recordArray(
  definition: NormalizedEChartDefinition,
  data: JsonRecord,
  key: string,
): JsonRecord[] {
  const value = data[key];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    fail(definition, `data.${key} must be an array of objects.`);
  }
  return value;
}

function tupleArray(
  definition: NormalizedEChartDefinition,
  data: JsonRecord,
  key: string,
  size: number,
): number[][] {
  const value = data[key];
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) =>
        Array.isArray(item) &&
        item.length === size &&
        item.every((inner) => typeof inner === "number"),
    )
  ) {
    fail(definition, `data.${key} must be an array of ${size}-number tuples.`);
  }
  return value;
}

function titleArgs(definition: NormalizedEChartDefinition): {
  title?: string | undefined;
  subtitle?: string | undefined;
} {
  return {
    title: definition.figure.title,
    subtitle: definition.figure.caption,
  };
}

function hasSeries(data: JsonRecord): boolean {
  return Array.isArray(data.series);
}

function seriesRecords(
  definition: NormalizedEChartDefinition,
  data: JsonRecord,
): JsonRecord[] {
  const series = recordArray(definition, data, "series");
  if (series.length === 0) {
    fail(definition, "data.series requires at least one series.");
  }
  return series;
}

function buildMultiSeriesLine(
  definition: NormalizedEChartDefinition,
  area: boolean,
): ChartOption {
  const data = definition.data;
  const x = categoryArray(definition, data, "x");
  const smooth = getBoolean(data, "smooth") ?? false;
  const compiledSeries = seriesRecords(definition, data).map((item, index) => {
    const name = getString(item, "name");
    if (!name?.trim())
      fail(definition, `data.series[${index}].name is required.`);
    const y = numberArray(definition, item, "y");
    if (y.length !== x.length) {
      fail(
        definition,
        `data.series[${index}] "${name}" length mismatch: expected ${x.length}, got ${y.length}.`,
      );
    }
    return { name, y };
  });
  const base = lineChartOption({
    ...titleArgs(definition),
    x,
    y: compiledSeries[0]!.y,
    name: "Value",
    smooth,
    area,
  }) as JsonRecord;
  const series = compiledSeries.map(({ name, y }) => {
    return {
      name,
      type: "line",
      data: y,
      smooth,
      showSymbol: y.length <= 24,
      ...(area ? { areaStyle: { opacity: 0.18 } } : {}),
    };
  });

  return {
    ...base,
    ...(data.legend !== undefined ? { legend: data.legend } : {}),
    series,
  } as ChartOption;
}

function buildMultiSeriesBar(
  definition: NormalizedEChartDefinition,
): ChartOption {
  const data = definition.data;
  const x = categoryArray(definition, data, "x");
  const horizontal = getBoolean(data, "horizontal") ?? false;
  const compiledSeries = seriesRecords(definition, data).map((item, index) => {
    const name = getString(item, "name");
    if (!name?.trim())
      fail(definition, `data.series[${index}].name is required.`);
    const y = numberArray(definition, item, "y");
    if (y.length !== x.length) {
      fail(
        definition,
        `data.series[${index}] "${name}" length mismatch: expected ${x.length}, got ${y.length}.`,
      );
    }
    return { name, y };
  });
  const base = barChartOption({
    ...titleArgs(definition),
    x,
    y: compiledSeries[0]!.y,
    name: "Value",
    horizontal,
  }) as JsonRecord;
  const series = compiledSeries.map(({ name, y }) => {
    return {
      name,
      type: "bar",
      data: y,
      barMaxWidth: 42,
    };
  });

  return {
    ...base,
    ...(data.legend !== undefined ? { legend: data.legend } : {}),
    series,
  } as ChartOption;
}

function buildLine(definition: NormalizedEChartDefinition): ChartOption {
  if (hasSeries(definition.data))
    return buildMultiSeriesLine(definition, false);
  const data = definition.data;
  return lineChartOption({
    ...titleArgs(definition),
    x: categoryArray(definition, data, "x"),
    y: numberArray(definition, data, "y"),
    name: getString(data, "name"),
    smooth: getBoolean(data, "smooth"),
    area: getBoolean(data, "area"),
  } satisfies LineChartOptionArgs);
}

function buildArea(definition: NormalizedEChartDefinition): ChartOption {
  if (hasSeries(definition.data)) return buildMultiSeriesLine(definition, true);
  const data = definition.data;
  return lineChartOption({
    ...titleArgs(definition),
    x: categoryArray(definition, data, "x"),
    y: numberArray(definition, data, "y"),
    name: getString(data, "name"),
    smooth: getBoolean(data, "smooth"),
    area: true,
  } satisfies LineChartOptionArgs);
}

function buildBar(definition: NormalizedEChartDefinition): ChartOption {
  if (hasSeries(definition.data)) return buildMultiSeriesBar(definition);
  const data = definition.data;
  return barChartOption({
    ...titleArgs(definition),
    x: categoryArray(definition, data, "x"),
    y: numberArray(definition, data, "y"),
    name: getString(data, "name"),
    horizontal: getBoolean(data, "horizontal"),
  } satisfies BarChartOptionArgs);
}

function buildPie(definition: NormalizedEChartDefinition): ChartOption {
  const data = definition.data;
  return pieChartOption({
    ...titleArgs(definition),
    data: recordArray(definition, data, "data") as any,
    name: getString(data, "name"),
    donut: definition.type === "donut" || getBoolean(data, "donut") === true,
    rose:
      definition.type === "rose"
        ? (getRoseMode(definition) ?? true)
        : getRoseMode(definition),
  });
}

const builders: Record<EChartPresetType, PresetBuilder> = {
  line: buildLine,
  area: buildArea,
  bar: buildBar,
  pie: buildPie,
  donut: buildPie,
  rose: buildPie,
  scatter: (definition) =>
    scatterChartOption({
      ...titleArgs(definition),
      data: tupleArray(definition, definition.data, "data", 2) as Array<
        [number, number]
      >,
      name: getString(definition.data, "name"),
      xName: getString(definition.data, "xName"),
      yName: getString(definition.data, "yName"),
      symbolSize: getNumber(definition.data, "symbolSize"),
    }),
  histogram: (definition) =>
    histogramChartOption({
      ...titleArgs(definition),
      values: numberArray(definition, definition.data, "values"),
      bins: getNumber(definition.data, "bins"),
      name: getString(definition.data, "name"),
    }),
  heatmap: (definition) =>
    heatmapChartOption({
      ...titleArgs(definition),
      x: stringArray(definition, definition.data, "x"),
      y: stringArray(definition, definition.data, "y"),
      data: tupleArray(definition, definition.data, "data", 3) as Array<
        [number, number, number]
      >,
      name: getString(definition.data, "name"),
      min: getNumber(definition.data, "min"),
      max: getNumber(definition.data, "max"),
    }),
  "correlation-heatmap": (definition) =>
    correlationHeatmapChartOption({
      ...titleArgs(definition),
      x: stringArray(definition, definition.data, "x"),
      y: stringArray(definition, definition.data, "y"),
      data: tupleArray(definition, definition.data, "data", 3) as Array<
        [number, number, number]
      >,
      name: getString(definition.data, "name"),
      min: getNumber(definition.data, "min"),
      max: getNumber(definition.data, "max"),
    }),
  treemap: (definition) =>
    treemapChartOption({
      ...titleArgs(definition),
      data: recordArray(definition, definition.data, "data") as any,
      name: getString(definition.data, "name"),
    }),
  sankey: (definition) =>
    sankeyChartOption({
      ...titleArgs(definition),
      nodes: recordArray(definition, definition.data, "nodes") as any,
      links: recordArray(definition, definition.data, "links") as any,
    }),
  boxplot: (definition) =>
    boxplotChartOption({
      ...titleArgs(definition),
      data: recordArray(definition, definition.data, "data") as any,
      name: getString(definition.data, "name"),
    }),
  "candlestick-volume": (definition) =>
    candlestickWithVolumeOption({
      ...titleArgs(definition),
      data: recordArray(definition, definition.data, "data") as any,
      priceName: getString(definition.data, "priceName"),
      volumeName: getString(definition.data, "volumeName"),
    }),
  macd: (definition) =>
    macdChartOption({
      ...titleArgs(definition),
      data: recordArray(definition, definition.data, "data") as any,
    }),
  rsi: (definition) =>
    rsiChartOption({
      ...titleArgs(definition),
      data: recordArray(definition, definition.data, "data") as any,
    }),
  "bollinger-bands": (definition) =>
    bollingerBandsChartOption({
      ...titleArgs(definition),
      data: recordArray(definition, definition.data, "data") as any,
    }),
  depth: (definition) =>
    depthChartOption({
      ...titleArgs(definition),
      bids: recordArray(definition, definition.data, "bids") as any,
      asks: recordArray(definition, definition.data, "asks") as any,
    }),
  "order-book": (definition) =>
    orderBookChartOption({
      ...titleArgs(definition),
      bids: recordArray(definition, definition.data, "bids") as any,
      asks: recordArray(definition, definition.data, "asks") as any,
    }),
  ohlc: (definition) =>
    ohlcChartOption({
      ...titleArgs(definition),
      data: recordArray(definition, definition.data, "data") as any,
    }),
  option: (definition) => {
    if (!definition.option) {
      fail(definition, 'type "option" requires an option object.');
    }
    return definition.option;
  },
};

function applyOverrides(
  option: ChartOption,
  overrides: ChartOption | undefined,
): ChartOption {
  if (!overrides) return option;
  return {
    ...(option as JsonRecord),
    ...(overrides as JsonRecord),
  } as ChartOption;
}

export interface CompiledEChartDefinition {
  option: ChartOption;
  clientOption?: ChartOption | undefined;
}

export function compileEChartDefinition(
  definition: NormalizedEChartDefinition,
): CompiledEChartDefinition {
  if (!SUPPORTED_TYPES.has(definition.type)) {
    fail(
      definition,
      `unsupported type. Use one of: ${ECHART_PRESET_TYPES.join(", ")}.`,
    );
  }

  const builder = builders[definition.type as EChartPresetType];
  const option = applyOverrides(builder(definition), definition.overrides);
  const clientOption =
    definition.clientOption === "same"
      ? option
      : definition.clientOption
        ? applyOverrides(definition.clientOption, definition.overrides)
        : undefined;

  return { option, clientOption };
}
