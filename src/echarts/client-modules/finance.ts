import { BoxplotChart, CandlestickChart, CustomChart } from "echarts/charts";
import * as echarts from "echarts/core";

let registered = false;

export function register(): void {
  if (registered) return;
  echarts.use([BoxplotChart, CandlestickChart, CustomChart]);
  registered = true;
}
