/**
 * bloomwright-ui / echarts — the ECharts render core.
 *
 * The "creation workflow": headless `echarts/core` + `SVGRenderer` turns a chart
 * option (from an `<EChart option={…} />` component or a parsed ` ```echart `
 * fence definition) into static SVG at build time, with opt-in per-chart client
 * hydration and a global artifact store for `svg-file` emission. It does NOT
 * register an Astro integration or parse Markdown — that extraction/glue layer
 * lives in `bloomwright-mdx`, which drives this core.
 */

// ── Fence definition parsing + compilation (driven by the mdx fence plugin) ───
export {
  parseEChartFenceDefinition,
  type EChartFenceDefinition,
  type NormalizedEChartDefinition,
  type EChartFenceParseContext,
} from "./definition.ts";
export { compileEChartDefinition } from "./presets.ts";

// ── Markup + SSR render ───────────────────────────────────────────────────────
export {
  renderEChartMarkup,
  type EChartRenderInput,
  type RenderedEChartMarkup,
} from "./markup.ts";
export { renderEChartSvg, withChartAriaDefaults } from "./server.ts";

// ── Build-time artifact store (driven by the mdx integration hooks) ───────────
export {
  registerEChartSvgArtifact,
  resetEChartArtifacts,
  setEChartArtifactBuildMode,
  emitEChartArtifacts,
  getChartArtifactHash,
  type RegisteredSvgArtifact,
} from "./artifacts.ts";

// ── Chart render/hydration mode normalizers + types ───────────────────────────
export {
  normalizeChartRenderMode,
  normalizeChartHydration,
  type ChartHydrationMode,
  type ChartRenderMode,
  type DeferredChartHydrationMode,
  type DeferredChartRenderMode,
} from "./component.ts";

// ── Option/theme/preset types for `<EChart option={…} />` consumers ───────────
export type { ChartOption, ChartTheme } from "./registry.ts";
export type { ChartClientPreset } from "./client-presets.ts";

// ── Chart-option builders for `<EChart option={…} />` authoring ───────────────
// Data-in → ECharts-option-out helpers (lineChartOption, barChartOption, …) plus
// their argument types. Lets a consumer hand-author charts without re-deriving
// option shapes; the same helpers the reference app uses on its chart pages.
export * from "./options.ts";
