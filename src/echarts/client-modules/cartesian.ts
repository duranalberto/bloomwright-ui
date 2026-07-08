import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import * as echarts from "echarts/core";

let registered = false;

export function register(): void {
  if (registered) return;
  echarts.use([LineChart, BarChart, ScatterChart]);
  registered = true;
}
