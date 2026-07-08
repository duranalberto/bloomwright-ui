/**
 * types.ts
 *
 * All type definitions for the mermaid integration.
 * Consolidates palette types, renderer contracts, and result shapes.
 */

export interface MermaidPalette {
  // ── Core surfaces (must be hex — Mermaid only accepts hex) ──────────────
  base100: string;
  base200: string;
  base300: string;
  baseContent: string;

  // ── Brand colors ────────────────────────────────────────────────────────
  primary: string;
  primaryContent: string;
  secondary: string;
  secondaryContent: string;
  accent: string;
  accentContent: string;
  neutral: string;
  neutralContent: string;

  // ── Semantic colors ─────────────────────────────────────────────────────
  info: string;
  success: string;
  warning: string;
  error: string;

  // ── Border tones ────────────────────────────────────────────────────────
  border: string;
  mutedBorder: string;

  // ── Subtle surfaces (used for clusters, labels, notes) ──────────────────
  subtleSurface: string;
  subtleSurface2: string;

  // ── Gantt semantic overrides ─────────────────────────────────────────────
  ganttActiveTaskBkg: string;
  ganttActiveTaskBorder: string;
  ganttDoneTaskBkg: string;
  ganttDoneTaskBorder: string;
  ganttCritBkg: string;
  ganttCritBorder: string;
  ganttExcludeBkg: string;
  ganttGridColor: string;
  ganttTodayLineColor: string;

  // ── Mode flag & typography ───────────────────────────────────────────────
  darkMode: boolean;
  fontFamily: string;
  fontSize: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Render service discriminated union
//
// Using a const enum-style object + union type keeps exhaustiveness checks
// working without needing a TypeScript enum (which Vite/ESM handles poorly).
// ─────────────────────────────────────────────────────────────────────────────

export const RenderService = {
  /** Batched multi-theme worker — returns one SVG per theme per diagram. */
  CloudflareWorker: "Cloudflare Worker",
  /** mermaid.ink public API — returns a single SVG with fixed `#mermaid-svg` id. */
  MermaidInk: "mermaid.ink",
  /** All providers failed — placeholder SVGs were substituted. */
  FailurePlaceholder: "failure-placeholders",
  /** Resolved from disk or memory cache — original service is irrelevant. */
  Cache: "cache",
} as const;

export type RenderService = (typeof RenderService)[keyof typeof RenderService];

export interface RenderResult {
  /** Results: Map<DiagramId, Map<ThemeName, SvgContent>> */
  results: Record<string, Map<string, string>>;
  /** Which rendering backend produced these results. */
  service: RenderService;
}

/**
 * Contract every renderer must implement.
 * A renderer receives a batch of diagrams and a theme map,
 * and returns a full RenderResult including service identity.
 */
export interface MermaidRenderer {
  name: string;
  render(
    diagrams: Array<{ id: string; code: string }>,
    themes: Map<string, MermaidPalette>,
  ): Promise<RenderResult>;
  isEnabled(): boolean;
}

/**
 * The caller-owned render port (SPEC §4.7). Production Mermaid SVGs are produced
 * by an EXTERNAL pipeline the consumer supplies via `bloomwrightMdx({ mermaid:
 * { render } })` — e.g. a Cloudflare Worker or a mermaid.ink client. It receives
 * a batch of diagrams plus the theme palettes and returns one SVG per theme per
 * diagram (the same `RenderResult` shape a `MermaidRenderer` produces).
 * bloomwright-ui itself only ever invokes its built-in `fixtureRenderPipeline`
 * (dev/tests); a reference production pipeline lives in the bloomwright-mdx
 * `examples/reference/` directory.
 */
export type MermaidRenderPipeline = (
  diagrams: Array<{ id: string; code: string }>,
  themes: Map<string, MermaidPalette>,
) => Promise<RenderResult>;

// ─────────────────────────────────────────────────────────────────────────────
// Options-first config (SPEC §4.6 / FR-CFG). Batching is threaded from the
// integration factory. Renderer endpoint/auth live entirely in the caller's
// injected `MermaidRenderPipeline` — the library holds no service config.
// ─────────────────────────────────────────────────────────────────────────────

/** Fully-resolved batching/rate-limit tuning (defaults from constants.ts). */
export interface MermaidBatchingConfig {
  chunkSize: number;
  flushDebounceMs: number;
  interChunkDelayMs: number;
}
