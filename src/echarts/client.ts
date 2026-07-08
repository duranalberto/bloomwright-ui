import {
  applyClientOptionPreset,
  type ChartClientPreset,
} from "./client-presets.ts";
import type { ChartOption, ChartTheme } from "./types.ts";
import { echarts, loadChartModules } from "./client-core.ts";

export interface EnhancedChartHandle {
  dispose: () => void;
}

export interface EnhanceEChartArgs {
  surface: HTMLElement;
  option: ChartOption;
  width: number;
  height: number;
  theme?: ChartTheme | undefined;
  optionClientPreset?: ChartClientPreset | undefined;
}

export async function enhanceEChart({
  surface,
  option,
  width,
  height,
  theme,
  optionClientPreset,
}: EnhanceEChartArgs): Promise<EnhancedChartHandle> {
  await loadChartModules(option);

  const mount = document.createElement("div");
  mount.className = "echart-enhanced-surface";
  mount.style.setProperty("--echart-width", `${width}px`);
  mount.style.setProperty("--echart-height", `${height}px`);
  mount.style.setProperty("--echart-aspect-ratio", `${width} / ${height}`);

  const chart = echarts.init(mount, theme ?? undefined, {
    renderer: "svg",
    width,
    height,
  });

  chart.setOption({
    ...applyClientOptionPreset(option, optionClientPreset),
    animation: false,
  });

  surface.replaceChildren(mount);
  surface.dataset.enhanced = "true";

  const resizeObserver = new ResizeObserver(() => {
    const nextWidth = mount.clientWidth || width;
    const nextHeight = mount.clientHeight || height;
    chart.resize({ width: nextWidth, height: nextHeight });
  });

  resizeObserver.observe(mount);
  chart.resize({
    width: mount.clientWidth || width,
    height: mount.clientHeight || height,
  });

  return {
    dispose() {
      resizeObserver.disconnect();
      chart.dispose();
    },
  };
}
