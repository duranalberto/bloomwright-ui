import * as echarts from "echarts/core";
import {
  BarChart,
  BoxplotChart,
  CandlestickChart,
  CustomChart,
  HeatmapChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
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

let registered = false;

export type { ChartOption, ChartTheme } from "./types.ts";

export function registerEChartsModules(): void {
  if (registered) return;

  echarts.use([
    LineChart,
    BarChart,
    BoxplotChart,
    PieChart,
    ScatterChart,
    CandlestickChart,
    HeatmapChart,
    TreemapChart,
    SankeyChart,
    CustomChart,
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

  registered = true;
}

export { echarts };
