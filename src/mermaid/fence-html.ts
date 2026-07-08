/**
 * fence-html.ts — static HTML for a prepared Mermaid diagram.
 *
 * `.mdx` mermaid fences render through the `<MermaidDiagram>` component, but
 * plain `.md` has no component mechanism, so bloomwright-mdx's fence plugin asks
 * for the finished HTML instead. This resolves the prepared diagram from the
 * render bridge (seeded by `mermaidRenderer`) and serializes the same
 * `.mermaid-diagram-container` markup the component's reading view produces.
 *
 * bloomwright-mdx calls this without knowing how the SVG was made — it only
 * hands over the code and emits the returned HTML.
 */
import { toHtml } from "hast-util-to-html";
import type { DiagramCacheStore } from "../shared/cache.ts";
import { resolvePreparedMermaidDiagram } from "./build-context.ts";
import type { RegisteredDiagram } from "./pipeline.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getDiagramDimensions(
  diagram: RegisteredDiagram,
): { width: number; height: number } | null {
  const viewBox = diagram.node.properties?.viewBox;
  if (typeof viewBox !== "string") return null;
  const parts = viewBox.trim().split(/[\s,]+/);
  const w = Number.parseFloat(parts[2] ?? "");
  const h = Number.parseFloat(parts[3] ?? "");
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
    return null;
  return { width: w, height: h };
}

function serializeInlineSvg(diagram: RegisteredDiagram): string | null {
  if (diagram.node.tagName !== "svg") return null;
  return toHtml(diagram.node, { space: "svg" });
}

/**
 * Serialize a prepared diagram for `<MermaidDiagramWrapper>`. Returns the inline
 * SVG markup (null on render failure) and the intrinsic dimensions from the
 * viewBox. Used by `<MermaidDiagram>.astro` to hand the wrapper the same inline
 * SVG the `.md` static path produces — so fence-generated and hand-written
 * diagrams render identically.
 */
export function serializeMermaidNode(diagram: RegisteredDiagram): {
  svgHtml: string | null;
  dims: { width: number; height: number } | null;
} {
  return {
    svgHtml: serializeInlineSvg(diagram),
    dims: getDiagramDimensions(diagram),
  };
}

function diagramSizeStyle(dims: { width: number; height: number }): string {
  const ratio = (dims.width / dims.height).toFixed(4);
  return `aspect-ratio: ${dims.width} / ${dims.height}; --diagram-ar: ${ratio}; --diagram-w: ${dims.width}px; --diagram-h: ${dims.height}px;`;
}

/**
 * Resolve `code` from the render bridge and serialize the static
 * `.mermaid-diagram-container` HTML. Pass a caller-owned `store` if you gave a
 * custom `cache` to `mermaidRenderer` (matches `<MermaidDiagram store>`). Throws
 * the same loud batch-miss error if the diagram was never prepared.
 */
export function renderMermaidFenceHtml(
  code: string,
  store?: DiagramCacheStore<RegisteredDiagram>,
): string {
  const { stableId, diagramType, diagram } = resolvePreparedMermaidDiagram(
    code,
    store,
  );

  const svgHtml = serializeInlineSvg(diagram);
  if (!diagram.assetHref || !svgHtml) {
    return '<div class="mermaid-error">Failed to render Mermaid diagram.</div>';
  }

  const lightSrc = escapeHtml(diagram.assetHref);
  const darkSrc = escapeHtml(diagram.assetHrefDark || diagram.assetHref);
  const dims = getDiagramDimensions(diagram);
  const figureStyle = dims ? ` style="${diagramSizeStyle(dims)}"` : "";
  const dimAttrs = dims
    ? ` data-diagram-width="${dims.width}" data-diagram-height="${dims.height}"`
    : "";

  return [
    `<div class="mermaid-diagram-container" data-diagram-src="${lightSrc}" data-diagram-dark-src="${darkSrc}" data-diagram-stable-id="${escapeHtml(stableId)}" data-diagram-cache-key="${escapeHtml(diagram.cacheKey)}" data-diagram-type="${escapeHtml(diagramType)}"${dimAttrs}>`,
    `<div class="mermaid-diagram-image"${figureStyle}>${svgHtml}</div>`,
    "</div>",
  ].join("");
}
