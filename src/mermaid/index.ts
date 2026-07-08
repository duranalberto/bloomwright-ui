/**
 * bloomwright-ui / mermaid — the Mermaid render core.
 *
 * This is the "creation workflow": given diagram definitions (+ theme palettes
 * + a caller-owned render pipeline), it produces themed light/dark static SVGs
 * through a caller-owned cache and resolves prepared output at component render
 * time. It does NOT scan sources or register an Astro integration — that
 * extraction/glue layer lives in `bloomwright-mdx`, which drives this core.
 *
 * Production SVGs come from an injected `MermaidRenderPipeline` (SPEC §4.7); the
 * built-in `fixtureRenderPipeline` is used only for dev/tests.
 */

// ── Pipeline (batch orchestration + cache) ───────────────────────────────────
export {
  createPipeline,
  DiagramPipeline,
  buildCacheKey,
  buildAssetHref,
  buildDarkAssetHref,
  finalizeRegisteredDiagram,
  resolveRemoteCacheBaseUrl,
  type PipelineConfig,
  type RegisteredDiagram,
} from "./pipeline.ts";

// ── Render port + fixture default ────────────────────────────────────────────
export { fixtureRenderPipeline, isFallbackSvg } from "./renderers.ts";

// ── Authoring API + addressing (shared with the mdx extraction layer) ─────────
export {
  defineMermaidDiagram,
  getMermaidStableId,
  getMermaidDiagramType,
  normalizeMermaidDefinition,
  type MermaidDiagramDefinition,
} from "./definition.ts";

// ── Render-time bridge (used by MermaidDiagram.astro) ─────────────────────────
export {
  resolvePreparedMermaidDiagram,
  setPreparedMermaidDiagrams,
  clearPreparedMermaidDiagrams,
  type ResolvedMermaidDiagram,
} from "./build-context.ts";

// ── Static fence HTML + node serializer (used by bloomwright-mdx `.md` path
//    and by MermaidDiagram.astro to hand the wrapper the inline SVG) ───────────
export { renderMermaidFenceHtml, serializeMermaidNode } from "./fence-html.ts";

// ── Build-time discovery (used by the mermaidRenderer integration) ────────────
export { collectMermaidDiagrams } from "./collect.ts";
export { extractMermaidDefinitionCalls } from "./source-parser.ts";

// ── Content-selection seam (shared; also used by bloomwrightMdx for echart) ───
export { identitySelection } from "../shared/content-selection.ts";
export type {
  SourceDocument,
  ContentSelection,
  SourceScanOptions,
} from "../shared/content-selection.ts";

// ── Themes + tuning constants ─────────────────────────────────────────────────
export { LIGHT_PALETTE, DARK_PALETTE } from "./palette.ts";
// Palette → Mermaid `themeVariables` — useful to a caller building its own
// `MermaidRenderPipeline` (see the reference renderer in examples/reference).
export { generateMermaidTheme } from "./theme.ts";
export {
  RENDERER_VERSION,
  CHUNK_SIZE,
  FLUSH_DEBOUNCE_MS,
  INTER_CHUNK_DELAY_MS,
} from "./constants.ts";

// ── Types ─────────────────────────────────────────────────────────────────────
export {
  RenderService,
  type MermaidPalette,
  type MermaidRenderPipeline,
  type MermaidRenderer,
  type MermaidBatchingConfig,
  type RenderResult,
} from "./types.ts";
