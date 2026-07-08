import { SankeyChart, TreemapChart } from "echarts/charts";
import * as echarts from "echarts/core";

let registered = false;

export function register(): void {
  if (registered) return;
  echarts.use([TreemapChart, SankeyChart]);
  registered = true;
}
