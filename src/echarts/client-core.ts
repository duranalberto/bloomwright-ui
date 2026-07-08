import * as echarts from "echarts/core";
import {
  AriaComponent,
  AxisPointerComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
} from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";
import type { ChartOption } from "./types.ts";

const moduleLoaders = {
  line: () => import("./client-modules/cartesian.ts"),
  bar: () => import("./client-modules/cartesian.ts"),
  scatter: () => import("./client-modules/cartesian.ts"),
  pie: () => import("./client-modules/pie.ts"),
  heatmap: () => import("./client-modules/heatmap.ts"),
  treemap: () => import("./client-modules/graph.ts"),
  sankey: () => import("./client-modules/graph.ts"),
  boxplot: () => import("./client-modules/finance.ts"),
  candlestick: () => import("./client-modules/finance.ts"),
  custom: () => import("./client-modules/finance.ts"),
} as const;

export type SupportedChartSeriesType = keyof typeof moduleLoaders;

let coreRegistered = false;

function registerClientCore(): void {
  if (coreRegistered) return;

  echarts.use([
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    DatasetComponent,
    TransformComponent,
    DataZoomComponent,
    VisualMapComponent,
    AxisPointerComponent,
    MarkLineComponent,
    MarkAreaComponent,
    MarkPointComponent,
    ToolboxComponent,
    AriaComponent,
    LabelLayout,
    UniversalTransition,
    SVGRenderer,
  ]);
  coreRegistered = true;
}

export function getChartSeriesTypes(option: ChartOption): string[] {
  const series = (option as Record<string, unknown>).series;
  const entries = Array.isArray(series) ? series : series ? [series] : [];

  return [
    ...new Set(
      entries.flatMap((entry) => {
        if (typeof entry !== "object" || entry === null) return [];
        const type = (entry as Record<string, unknown>).type;
        return typeof type === "string" && type.length > 0 ? [type] : [];
      }),
    ),
  ];
}

export async function loadChartModules(option: ChartOption): Promise<void> {
  registerClientCore();

  const types = getChartSeriesTypes(option);
  const unsupported = types.filter((type) => !(type in moduleLoaders));
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported ECharts client series type(s): ${unsupported.join(", ")}.`,
    );
  }

  const loaders = new Set(
    types.map((type) => moduleLoaders[type as SupportedChartSeriesType]),
  );
  const modules = await Promise.all([...loaders].map((load) => load()));
  modules.forEach((module) => module.register());
}

export { echarts };
