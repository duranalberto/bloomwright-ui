/**
 * renderers.ts — the built-in fixture render pipeline + failure detection.
 *
 * Production rendering is CALLER-OWNED. The consumer passes a
 * `MermaidRenderPipeline` (SPEC §4.7) that turns diagram text into themed SVGs —
 * e.g. a Cloudflare Worker or a mermaid.ink client. bloomwright-ui ships only:
 *
 *   - `fixtureRenderPipeline` — deterministic, network-free SVGs, used as the
 *     default when no pipeline is injected. It exists for tests and local dev;
 *     a real build should pass its own `mermaid.render`.
 *   - `isFallbackSvg` — detects the sentinel placeholder markup so the pipeline
 *     never persists a known-bad SVG into the durable cache.
 *
 * A reference Cloudflare Worker / mermaid.ink pipeline (deflate + pako encoding,
 * auth headers, 503 backoff, the provider chain) lives in the bloomwright-mdx
 * `examples/reference/` directory — copy it into your app and wire it through
 * `bloomwrightMdx({ mermaid: { render } })`.
 */

import {
  RenderService,
  type MermaidPalette,
  type MermaidRenderPipeline,
  type RenderResult,
} from "./types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture renderer — deterministic SVGs with no network (default / tests).
// ─────────────────────────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFixtureSvg(
  diagram: { id: string; code: string },
  themeName: string,
): string {
  const renderId = `fixture-${themeName}-${diagram.id}`;
  const isDark = themeName === "dark";
  const fill = isDark ? "#1f2937" : "#ffffff";
  const stroke = isDark ? "#93c5fd" : "#2563eb";
  const text = isDark ? "#f8fafc" : "#111827";
  const label = escapeXml(diagram.code.split(/\s+/)[0] ?? "diagram");

  return `<svg id="${renderId}" data-diagram-type="flowchart" width="100%" viewBox="0 0 260 120" style="max-width: 260px;" xmlns="http://www.w3.org/2000/svg">
  <style>
    :root { --fixture-font: Inter, sans-serif; }
    #${renderId} .node rect { fill: ${fill}; stroke: ${stroke}; }
    #${renderId} .node text { fill: ${text}; font-family: var(--fixture-font); }
    #${renderId} .edgePath path { stroke: ${stroke}; }
    @keyframes fixture-dash { to { stroke-dashoffset: 0; } }
  </style>
  <defs>
    <marker id="${renderId}-pointEnd" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${stroke}"/>
    </marker>
  </defs>
  <g class="node" id="${renderId}-A">
    <rect class="basic" x="20" y="24" width="92" height="44" rx="6"/>
    <text x="66" y="52" text-anchor="middle">${label}</text>
  </g>
  <g class="node" id="${renderId}-B">
    <rect class="basic" x="148" y="24" width="92" height="44" rx="6"/>
    <text x="194" y="52" text-anchor="middle">${escapeXml(themeName)}</text>
  </g>
  <path class="edgePath" d="M 112 46 L 148 46" fill="none" marker-end="url(#${renderId}-pointEnd)"/>
</svg>`;
}

function buildFixtureResult(
  diagrams: Array<{ id: string; code: string }>,
  themes: Map<string, MermaidPalette>,
): RenderResult {
  const results: Record<string, Map<string, string>> = {};
  const themeNames = themes.size > 0 ? Array.from(themes.keys()) : ["default"];

  for (const diagram of diagrams) {
    const diagramResults = new Map<string, string>();
    for (const themeName of themeNames) {
      diagramResults.set(themeName, buildFixtureSvg(diagram, themeName));
    }
    results[diagram.id] = diagramResults;
  }

  // Fixtures mimic the Cloudflare Worker's output shape (one stable-id SVG per
  // theme with scoped CSS), so the transform selects the worker strategy.
  return { results, service: RenderService.CloudflareWorker };
}

/**
 * The default `MermaidRenderPipeline` when the caller injects none. Deterministic
 * and network-free — suitable for tests and local dev, never a real build.
 */
export const fixtureRenderPipeline: MermaidRenderPipeline = async (
  diagrams,
  themes,
) => buildFixtureResult(diagrams, themes);

/**
 * SVGs that must NOT be cached — the sentinel worker error and our placeholder.
 * A caller-supplied pipeline may return these; the pipeline uses this to avoid
 * persisting a known-bad render into the durable cache.
 */
export function isFallbackSvg(svg: string): boolean {
  return (
    svg.includes('id="mermaid-error"') ||
    svg.includes('id="mermaid-placeholder"')
  );
}
