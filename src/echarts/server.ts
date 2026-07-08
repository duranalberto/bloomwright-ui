import type { ChartOption, ChartTheme } from "./registry.ts";
import { echarts, registerEChartsModules } from "./registry.ts";

export interface RenderEChartSvgOptions {
  option: ChartOption;
  width: number;
  height: number;
  theme?: ChartTheme | undefined;
}

export function withChartAriaDefaults(
  option: ChartOption,
  description?: string,
  aria?: Record<string, unknown> | undefined,
): ChartOption {
  const existingAria =
    typeof option.aria === "object" && option.aria !== null ? option.aria : {};

  return {
    ...option,
    aria: {
      show: true,
      ...(description ? { description } : {}),
      ...existingAria,
      ...(aria ?? {}),
    },
  };
}

export function renderEChartSvg({
  option,
  width,
  height,
  theme,
}: RenderEChartSvgOptions): string {
  if (!Number.isFinite(width) || width <= 0) {
    throw new TypeError("EChart width must be a positive number.");
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new TypeError("EChart height must be a positive number.");
  }

  registerEChartsModules();

  const chart = echarts.init(null, theme ?? null, {
    renderer: "svg",
    ssr: true,
    width,
    height,
  });

  try {
    chart.setOption(option);
    return chart.renderToSVGString();
  } finally {
    chart.dispose();
  }
}
