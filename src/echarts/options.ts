import type { ChartOption } from "./registry.ts";

const CHART_COLORS = [
  "#d65a31",
  "#d99a2b",
  "#2f80b7",
  "#2f9d72",
  "#8b5cf6",
  "#d14f86",
  "#5a7d9a",
  "#c75c5c",
];

const AXIS_TEXT_COLOR = "currentColor";
const GRID_LINE_COLOR = "rgba(148, 163, 184, 0.35)";
const UP_COLOR = "#2f9d72";
const DOWN_COLOR = "#d65a31";

export interface NamedValue {
  name: string;
  value: number;
}

export interface LineChartOptionArgs {
  x: Array<string | number>;
  y: number[];
  name?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  smooth?: boolean | undefined;
  area?: boolean | undefined;
}

export interface BarChartOptionArgs {
  x: Array<string | number>;
  y: number[];
  name?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  horizontal?: boolean | undefined;
}

export interface PieChartOptionArgs {
  data: NamedValue[];
  name?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  donut?: boolean | undefined;
  rose?: boolean | "radius" | "area" | undefined;
}

export interface ScatterChartOptionArgs {
  data: Array<[number, number]>;
  name?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  xName?: string | undefined;
  yName?: string | undefined;
  symbolSize?: number | undefined;
}

export interface HistogramBin {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface HistogramChartOptionArgs {
  values: number[];
  bins?: number | undefined;
  name?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
}

export interface HeatmapChartOptionArgs {
  x: string[];
  y: string[];
  data: Array<[number, number, number]>;
  name?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
}

export interface TreemapNode {
  name: string;
  value?: number | undefined;
  children?: TreemapNode[] | undefined;
}

export interface TreemapChartOptionArgs {
  data: TreemapNode[];
  name?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
}

export interface SankeyNode {
  name: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyChartOptionArgs {
  nodes: SankeyNode[];
  links: SankeyLink[];
  title?: string | undefined;
  subtitle?: string | undefined;
}

export interface BoxplotDatum {
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface BoxplotChartOptionArgs {
  data: BoxplotDatum[];
  name?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
}

export interface CandleVolumeDatum {
  date: string;
  open: number;
  close: number;
  low: number;
  high: number;
  volume: number;
}

export interface CandlestickWithVolumeOptionArgs {
  data: CandleVolumeDatum[];
  title?: string | undefined;
  subtitle?: string | undefined;
  priceName?: string | undefined;
  volumeName?: string | undefined;
}

export interface MacdPoint {
  macd: number;
  signal: number;
  histogram: number;
}

export interface RsiPoint {
  value: number;
}

export interface BollingerBandPoint {
  lower: number;
  middle: number;
  upper: number;
}

export interface FinanceIndicatorOptionArgs {
  data: CandleVolumeDatum[];
  title?: string | undefined;
  subtitle?: string | undefined;
}

export interface DepthLevel {
  price: number;
  size: number;
}

export interface DepthChartOptionArgs {
  bids: DepthLevel[];
  asks: DepthLevel[];
  title?: string | undefined;
  subtitle?: string | undefined;
}

export interface OrderBookOptionArgs {
  bids: DepthLevel[];
  asks: DepthLevel[];
  title?: string | undefined;
  subtitle?: string | undefined;
}

function baseOption(title?: string, subtitle?: string): ChartOption {
  return {
    color: CHART_COLORS,
    backgroundColor: "transparent",
    textStyle: {
      color: AXIS_TEXT_COLOR,
      fontFamily: "Inter, system-ui, sans-serif",
    },
    aria: {
      show: true,
    },
    ...(title
      ? {
          title: {
            text: title,
            ...(subtitle ? { subtext: subtitle } : {}),
            left: "center",
            textStyle: { color: AXIS_TEXT_COLOR, fontWeight: 700 },
            subtextStyle: { color: AXIS_TEXT_COLOR },
          },
        }
      : {}),
  };
}

function assertSameLength(
  label: string,
  expected: number,
  actual: number,
): void {
  if (expected !== actual) {
    throw new Error(
      `${label} length mismatch: expected ${expected}, got ${actual}.`,
    );
  }
}

function assertNonEmpty<T>(label: string, items: T[]): void {
  if (items.length === 0) {
    throw new Error(`${label} requires at least one value.`);
  }
}

function rounded(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function valueAxis() {
  return {
    type: "value",
    axisLabel: { color: AXIS_TEXT_COLOR },
    splitLine: { lineStyle: { color: GRID_LINE_COLOR } },
  };
}

function categoryAxis(data: Array<string | number>) {
  return {
    type: "category",
    data,
    axisLabel: { color: AXIS_TEXT_COLOR },
    axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
  };
}

function candleArrays(data: CandleVolumeDatum[]) {
  return {
    dates: data.map((item) => item.date),
    prices: data.map((item) => [item.open, item.close, item.low, item.high]),
    closes: data.map((item) => item.close),
    volumes: data.map((item) => item.volume),
  };
}

export function lineChartOption({
  x,
  y,
  name = "Value",
  title,
  subtitle,
  smooth = false,
  area = false,
}: LineChartOptionArgs): ChartOption {
  assertSameLength("line chart x/y", x.length, y.length);

  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "axis" },
    grid: { left: 48, right: 24, top: title ? 72 : 32, bottom: 44 },
    xAxis: categoryAxis(x),
    yAxis: valueAxis(),
    series: [
      {
        name,
        type: "line",
        data: y,
        smooth,
        showSymbol: y.length <= 24,
        ...(area ? { areaStyle: { opacity: 0.18 } } : {}),
      },
    ],
  };
}

export function barChartOption({
  x,
  y,
  name = "Value",
  title,
  subtitle,
  horizontal = false,
}: BarChartOptionArgs): ChartOption {
  assertSameLength("bar chart x/y", x.length, y.length);

  const categories = categoryAxis(x);
  const values = valueAxis();

  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "axis" },
    grid: {
      left: horizontal ? 84 : 48,
      right: 24,
      top: title ? 72 : 32,
      bottom: 44,
    },
    xAxis: horizontal ? values : categories,
    yAxis: horizontal ? categories : values,
    series: [
      {
        name,
        type: "bar",
        data: y,
        barMaxWidth: 42,
      },
    ],
  };
}

export function pieChartOption({
  data,
  name = "Value",
  title,
  subtitle,
  donut = false,
  rose = false,
}: PieChartOptionArgs): ChartOption {
  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      type: "scroll",
      textStyle: { color: AXIS_TEXT_COLOR },
    },
    series: [
      {
        name,
        type: "pie",
        radius: donut ? ["42%", "68%"] : "68%",
        center: ["50%", title ? "52%" : "46%"],
        data,
        ...(rose ? { roseType: rose === true ? "radius" : rose } : {}),
        label: { color: AXIS_TEXT_COLOR },
      },
    ],
  };
}

export function scatterChartOption({
  data,
  name = "Value",
  title,
  subtitle,
  xName,
  yName,
  symbolSize = 16,
}: ScatterChartOptionArgs): ChartOption {
  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "item" },
    grid: { left: 56, right: 28, top: title ? 84 : 42, bottom: 48 },
    xAxis: { ...valueAxis(), ...(xName ? { name: xName } : {}) },
    yAxis: { ...valueAxis(), ...(yName ? { name: yName } : {}) },
    series: [
      {
        name,
        type: "scatter",
        symbolSize,
        data,
      },
    ],
  };
}

export function calculateHistogramBins(
  values: number[],
  requestedBins?: number,
): HistogramBin[] {
  assertNonEmpty("histogram", values);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.max(
    1,
    requestedBins ?? Math.ceil(Math.sqrt(values.length)),
  );

  if (min === max) {
    return [{ label: `${min}`, min, max, count: values.length }];
  }

  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => {
    const start = min + width * index;
    const end = index === binCount - 1 ? max : start + width;
    return {
      label: `${rounded(start, 2)}-${rounded(end, 2)}`,
      min: rounded(start, 4),
      max: rounded(end, 4),
      count: 0,
    };
  });

  values.forEach((value) => {
    const index =
      value === max ? binCount - 1 : Math.floor((value - min) / width);
    bins[Math.max(0, Math.min(binCount - 1, index))]!.count += 1;
  });

  return bins;
}

export function histogramChartOption({
  values,
  bins,
  name = "Frequency",
  title,
  subtitle,
}: HistogramChartOptionArgs): ChartOption {
  const histogramBins = calculateHistogramBins(values, bins);

  return barChartOption({
    title,
    subtitle,
    name,
    x: histogramBins.map((bin) => bin.label),
    y: histogramBins.map((bin) => bin.count),
  });
}

export function heatmapChartOption({
  x,
  y,
  data,
  name = "Value",
  title,
  subtitle,
  min,
  max,
}: HeatmapChartOptionArgs): ChartOption {
  assertNonEmpty("heatmap", data);

  const values = data.map((item) => item[2]);
  const visualMin = min ?? Math.min(...values);
  const visualMax = max ?? Math.max(...values);

  return {
    ...baseOption(title, subtitle),
    tooltip: { position: "top" },
    grid: { left: 72, right: 36, top: title ? 84 : 42, bottom: 72 },
    xAxis: {
      type: "category",
      data: x,
      splitArea: { show: true },
      axisLabel: { color: AXIS_TEXT_COLOR },
    },
    yAxis: {
      type: "category",
      data: y,
      splitArea: { show: true },
      axisLabel: { color: AXIS_TEXT_COLOR },
    },
    visualMap: {
      min: visualMin,
      max: visualMax,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 12,
      textStyle: { color: AXIS_TEXT_COLOR },
    },
    series: [
      {
        name,
        type: "heatmap",
        data,
        label: { show: false },
      },
    ],
  };
}

export function correlationHeatmapChartOption(
  args: HeatmapChartOptionArgs,
): ChartOption {
  return {
    ...heatmapChartOption({ min: -1, max: 1, ...args }),
    visualMap: {
      min: args.min ?? -1,
      max: args.max ?? 1,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 12,
      textStyle: { color: AXIS_TEXT_COLOR },
      inRange: {
        color: ["#d65a31", "#f7f0e8", "#2f80b7"],
      },
    },
  };
}

export function treemapChartOption({
  data,
  name = "Value",
  title,
  subtitle,
}: TreemapChartOptionArgs): ChartOption {
  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "item" },
    series: [
      {
        name,
        type: "treemap",
        top: title ? 82 : 18,
        left: 16,
        right: 16,
        bottom: 16,
        roam: false,
        breadcrumb: { show: false },
        label: { color: "#ffffff" },
        data,
      },
    ],
  };
}

export function sankeyChartOption({
  nodes,
  links,
  title,
  subtitle,
}: SankeyChartOptionArgs): ChartOption {
  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "item" },
    series: [
      {
        type: "sankey",
        top: title ? 82 : 24,
        left: 24,
        right: 24,
        bottom: 24,
        nodeAlign: "justify",
        emphasis: { focus: "adjacency" },
        label: { color: AXIS_TEXT_COLOR },
        data: nodes,
        links,
      },
    ],
  };
}

export function boxplotChartOption({
  data,
  name = "Distribution",
  title,
  subtitle,
}: BoxplotChartOptionArgs): ChartOption {
  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "item" },
    grid: { left: 56, right: 28, top: title ? 84 : 42, bottom: 48 },
    xAxis: categoryAxis(data.map((item) => item.name)),
    yAxis: valueAxis(),
    series: [
      {
        name,
        type: "boxplot",
        data: data.map((item) => [
          item.min,
          item.q1,
          item.median,
          item.q3,
          item.max,
        ]),
      },
    ],
  };
}

export function candlestickWithVolumeOption({
  data,
  title,
  subtitle,
  priceName = "Price",
  volumeName = "Volume",
}: CandlestickWithVolumeOptionArgs): ChartOption {
  const { dates, prices, volumes } = candleArrays(data);

  return {
    ...baseOption(title, subtitle),
    legend: {
      top: title ? 48 : 8,
      textStyle: { color: AXIS_TEXT_COLOR },
    },
    tooltip: { trigger: "axis" },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid: [
      { left: 64, right: 32, top: title ? 88 : 48, height: "54%" },
      { left: 64, right: 32, top: "76%", height: "14%" },
    ],
    xAxis: [
      {
        ...categoryAxis(dates),
        boundaryGap: false,
      },
      {
        ...categoryAxis(dates),
        gridIndex: 1,
        boundaryGap: false,
      },
    ],
    yAxis: [
      {
        ...valueAxis(),
        scale: true,
      },
      {
        ...valueAxis(),
        scale: true,
        gridIndex: 1,
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 0, end: 100 },
      { show: true, xAxisIndex: [0, 1], bottom: 8, height: 18 },
    ],
    series: [
      {
        name: priceName,
        type: "candlestick",
        data: prices,
        itemStyle: {
          color: UP_COLOR,
          color0: DOWN_COLOR,
          borderColor: UP_COLOR,
          borderColor0: DOWN_COLOR,
        },
      },
      {
        name: volumeName,
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
      },
    ],
  };
}

export function calculateEma(values: number[], period: number): number[] {
  assertNonEmpty("EMA", values);

  const multiplier = 2 / (period + 1);
  const output = [values[0]!];

  for (let index = 1; index < values.length; index += 1) {
    output.push(
      rounded(
        (values[index]! - output[index - 1]!) * multiplier + output[index - 1]!,
      ),
    );
  }

  return output;
}

export function calculateMacd(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MacdPoint[] {
  assertNonEmpty("MACD", values);

  const fast = calculateEma(values, fastPeriod);
  const slow = calculateEma(values, slowPeriod);
  const macd = values.map((_, index) => rounded(fast[index]! - slow[index]!));
  const signal = calculateEma(macd, signalPeriod);

  return macd.map((value, index) => ({
    macd: value,
    signal: signal[index]!,
    histogram: rounded(value - signal[index]!),
  }));
}

export function calculateRsi(values: number[], period = 14): RsiPoint[] {
  assertNonEmpty("RSI", values);

  return values.map((_, index) => {
    if (index === 0) return { value: 50 };

    const start = Math.max(1, index - period + 1);
    let gains = 0;
    let losses = 0;

    for (let inner = start; inner <= index; inner += 1) {
      const change = values[inner]! - values[inner - 1]!;
      if (change >= 0) gains += change;
      else losses += Math.abs(change);
    }

    const span = index - start + 1;
    const averageGain = gains / span;
    const averageLoss = losses / span;

    if (averageGain === 0 && averageLoss === 0) return { value: 50 };
    if (averageLoss === 0) return { value: 100 };

    const relativeStrength = averageGain / averageLoss;
    return { value: rounded(100 - 100 / (1 + relativeStrength), 2) };
  });
}

export function calculateBollingerBands(
  values: number[],
  period = 20,
  deviation = 2,
): BollingerBandPoint[] {
  assertNonEmpty("Bollinger Bands", values);

  return values.map((_, index) => {
    const start = Math.max(0, index - period + 1);
    const window = values.slice(start, index + 1);
    const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
    const variance =
      window.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      window.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      lower: rounded(mean - standardDeviation * deviation),
      middle: rounded(mean),
      upper: rounded(mean + standardDeviation * deviation),
    };
  });
}

export function macdChartOption({
  data,
  title,
  subtitle,
}: FinanceIndicatorOptionArgs): ChartOption {
  const { dates, prices, volumes, closes } = candleArrays(data);
  const macd = calculateMacd(closes);

  return {
    ...baseOption(title, subtitle),
    legend: { top: title ? 48 : 8, textStyle: { color: AXIS_TEXT_COLOR } },
    tooltip: { trigger: "axis" },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid: [
      { left: 64, right: 32, top: title ? 88 : 48, height: "38%" },
      { left: 64, right: 32, top: "58%", height: "12%" },
      { left: 64, right: 32, top: "78%", height: "12%" },
    ],
    xAxis: [
      { ...categoryAxis(dates), boundaryGap: false },
      { ...categoryAxis(dates), gridIndex: 1, boundaryGap: false },
      { ...categoryAxis(dates), gridIndex: 2, boundaryGap: false },
    ],
    yAxis: [
      { ...valueAxis(), scale: true },
      { ...valueAxis(), gridIndex: 1, splitLine: { show: false } },
      { ...valueAxis(), gridIndex: 2, splitLine: { show: false } },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1, 2], start: 0, end: 100 },
      { show: true, xAxisIndex: [0, 1, 2], bottom: 8, height: 18 },
    ],
    series: [
      {
        name: "Price",
        type: "candlestick",
        data: prices,
        itemStyle: {
          color: UP_COLOR,
          color0: DOWN_COLOR,
          borderColor: UP_COLOR,
          borderColor0: DOWN_COLOR,
        },
      },
      {
        name: "Volume",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
      },
      {
        name: "MACD histogram",
        type: "bar",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: macd.map((item) => item.histogram),
      },
      {
        name: "MACD",
        type: "line",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: macd.map((item) => item.macd),
        showSymbol: false,
      },
      {
        name: "Signal",
        type: "line",
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: macd.map((item) => item.signal),
        showSymbol: false,
      },
    ],
  };
}

export function rsiChartOption({
  data,
  title,
  subtitle,
}: FinanceIndicatorOptionArgs): ChartOption {
  const { dates, closes } = candleArrays(data);
  const rsi = calculateRsi(closes);

  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "axis" },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid: [
      { left: 64, right: 32, top: title ? 84 : 42, height: "50%" },
      { left: 64, right: 32, top: "74%", height: "16%" },
    ],
    xAxis: [
      { ...categoryAxis(dates), boundaryGap: false },
      { ...categoryAxis(dates), gridIndex: 1, boundaryGap: false },
    ],
    yAxis: [
      { ...valueAxis(), scale: true },
      { ...valueAxis(), min: 0, max: 100, gridIndex: 1 },
    ],
    series: [
      {
        name: "Close",
        type: "line",
        data: closes,
        showSymbol: false,
      },
      {
        name: "RSI",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: rsi.map((item) => item.value),
        showSymbol: false,
        markLine: {
          symbol: "none",
          data: [{ yAxis: 70 }, { yAxis: 30 }],
        },
      },
    ],
  };
}

export function bollingerBandsChartOption({
  data,
  title,
  subtitle,
}: FinanceIndicatorOptionArgs): ChartOption {
  const { dates, closes } = candleArrays(data);
  const bands = calculateBollingerBands(closes);

  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "axis" },
    legend: { top: title ? 48 : 8, textStyle: { color: AXIS_TEXT_COLOR } },
    grid: { left: 64, right: 32, top: title ? 88 : 48, bottom: 48 },
    xAxis: { ...categoryAxis(dates), boundaryGap: false },
    yAxis: { ...valueAxis(), scale: true },
    series: [
      { name: "Close", type: "line", data: closes, showSymbol: false },
      {
        name: "Upper band",
        type: "line",
        data: bands.map((item) => item.upper),
        showSymbol: false,
        lineStyle: { type: "dashed" },
      },
      {
        name: "Middle band",
        type: "line",
        data: bands.map((item) => item.middle),
        showSymbol: false,
      },
      {
        name: "Lower band",
        type: "line",
        data: bands.map((item) => item.lower),
        showSymbol: false,
        lineStyle: { type: "dashed" },
      },
    ],
  };
}

function cumulativeLevels(levels: DepthLevel[], ascending: boolean) {
  const sorted = [...levels].sort((a, b) =>
    ascending ? a.price - b.price : b.price - a.price,
  );
  let total = 0;
  return sorted.map((level) => {
    total += level.size;
    return [level.price, rounded(total, 2)];
  });
}

export function depthChartOption({
  bids,
  asks,
  title,
  subtitle,
}: DepthChartOptionArgs): ChartOption {
  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "axis" },
    grid: { left: 64, right: 32, top: title ? 84 : 42, bottom: 48 },
    xAxis: { ...valueAxis(), name: "Price" },
    yAxis: { ...valueAxis(), name: "Cumulative size" },
    series: [
      {
        name: "Bids",
        type: "line",
        data: cumulativeLevels(bids, false),
        showSymbol: false,
        areaStyle: { opacity: 0.22 },
        lineStyle: { color: UP_COLOR },
      },
      {
        name: "Asks",
        type: "line",
        data: cumulativeLevels(asks, true),
        showSymbol: false,
        areaStyle: { opacity: 0.22 },
        lineStyle: { color: DOWN_COLOR },
      },
    ],
  };
}

export function orderBookChartOption({
  bids,
  asks,
  title,
  subtitle,
}: OrderBookOptionArgs): ChartOption {
  const prices = Array.from(
    new Set([...bids, ...asks].map((level) => level.price)),
  )
    .sort((a, b) => b - a)
    .map(String);
  const bidMap = new Map(
    bids.map((level) => [String(level.price), level.size]),
  );
  const askMap = new Map(
    asks.map((level) => [String(level.price), level.size]),
  );

  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "axis" },
    legend: { top: title ? 48 : 8, textStyle: { color: AXIS_TEXT_COLOR } },
    grid: { left: 72, right: 32, top: title ? 88 : 48, bottom: 36 },
    xAxis: valueAxis(),
    yAxis: categoryAxis(prices),
    series: [
      {
        name: "Bid size",
        type: "bar",
        stack: "book",
        data: prices.map((price) => bidMap.get(price) ?? 0),
        itemStyle: { color: UP_COLOR },
      },
      {
        name: "Ask size",
        type: "bar",
        stack: "book",
        data: prices.map((price) => askMap.get(price) ?? 0),
        itemStyle: { color: DOWN_COLOR },
      },
    ],
  };
}

export function ohlcChartOption({
  data,
  title,
  subtitle,
}: FinanceIndicatorOptionArgs): ChartOption {
  const { dates } = candleArrays(data);
  const values = data.map((item, index) => [
    index,
    item.open,
    item.close,
    item.low,
    item.high,
  ]);

  return {
    ...baseOption(title, subtitle),
    tooltip: { trigger: "axis" },
    grid: { left: 64, right: 32, top: title ? 84 : 42, bottom: 48 },
    xAxis: categoryAxis(dates),
    yAxis: { ...valueAxis(), scale: true },
    series: [
      {
        name: "OHLC",
        type: "custom",
        data: values,
        renderItem(_params: any, api: any) {
          const x = api.coord([api.value(0), api.value(2)])[0];
          const open = api.coord([api.value(0), api.value(1)]);
          const close = api.coord([api.value(0), api.value(2)]);
          const low = api.coord([api.value(0), api.value(3)]);
          const high = api.coord([api.value(0), api.value(4)]);
          const tick = Math.max(5, api.size([1, 0])[0] * 0.22);
          const color = api.value(2) >= api.value(1) ? UP_COLOR : DOWN_COLOR;
          const style = api.style({ stroke: color, lineWidth: 2 });

          return {
            type: "group",
            children: [
              {
                type: "line",
                shape: { x1: x, y1: low[1], x2: x, y2: high[1] },
                style,
              },
              {
                type: "line",
                shape: {
                  x1: x - tick,
                  y1: open[1],
                  x2: x,
                  y2: open[1],
                },
                style,
              },
              {
                type: "line",
                shape: {
                  x1: x,
                  y1: close[1],
                  x2: x + tick,
                  y2: close[1],
                },
                style,
              },
            ],
          };
        },
      },
    ],
  };
}
