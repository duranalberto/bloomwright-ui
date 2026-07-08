/**
 * transform.ts
 *
 * Builds a single HAST <svg> element supporting multiple DaisyUI themes.
 *
 * ## Two transform strategies
 *
 * ### Worker strategy  (buildMergedThemeNodeWorker)
 * Used when SVGs come from the Cloudflare Worker.
 * The worker renders each theme independently using a dynamic `renderId`
 * (e.g. `res-light-9193`).  CSS inside each SVG is scoped to that id, so:
 *   1. Strip the `renderId` prefix from CSS rules.
 *   2. Re-scope the first theme under `#mermaid-<stableId>` (no guard).
 *   3. Re-scope subsequent themes under `[data-theme="X"] #mermaid-<stableId>`.
 *   4. Merge all scoped blocks into a single <style> in the base SVG tree.
 *
 * ### Ink strategy  (buildMergedThemeNodeInk)
 * Used when SVGs come from mermaid.ink.
 * mermaid.ink always returns `id="mermaid-svg"` and scopes its <style> CSS to
 * `#mermaid-svg`. classDef colours are emitted ONLY as inline style attributes
 * on node elements (not in the <style> block), so they must be hoisted into
 * CSS rules before the inline declarations are removed.
 *
 * NOTE: mermaid.ink prepends a <style xmlns="...">@import url(...)</style>
 * element for Font Awesome BEFORE the main diagram <style> block. The main
 * style block is always the largest one. extractStyleText uses length-based
 * selection to reliably find the correct block regardless of ordering.
 *
 *   1. For each theme SVG, call hoistInlineColorsToCss() which:
 *        a. Walks every .node group and collects child elements with colour
 *           inline styles (fill, stroke, color, stroke-width …).
 *        b. Emits a scoped CSS rule per child: `scopePrefix #nodeId childSel`.
 *        c. Strips the colour declarations from the inline style attribute
 *           (non-colour properties are preserved).
 *   2. Strip the literal `#mermaid-svg` prefix from the <style> CSS block.
 *   3. Re-scope the first theme under `#mermaid-<stableId>` (no guard).
 *   4. Re-scope subsequent themes under `[data-theme="X"] #mermaid-<stableId>`.
 *   5. Merge hoisted rules + scoped block into one <style> in the base SVG.
 *   6. Rename the SVG root id to `mermaid-<stableId>` via updateHastIds.
 *
 * ### Service-aware dispatcher  (buildMergedThemeNode)
 * Accepts the `RenderService` value and delegates to the correct strategy.
 */

import type { Element as HastElement, Root as HastRoot } from "hast";
import { select } from "hast-util-select";
import postcss from "postcss";
import {
  collapseForeignObjectLineBreaks,
  hoistInlineColorsToCss,
  parseSvgToHast,
  sanitizeStyleAttributes,
  stripScripts,
  updateHastIds,
} from "./hast.ts";
import { RenderService } from "./types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────────────────

function extractSvgId(rawSvg: string): string | null {
  const m = rawSvg.match(/<svg[^>]+\bid="([^"]+)"/i);
  return m ? (m[1] ?? null) : null;
}

/**
 * Extracts the main diagram CSS from the SVG's <style> elements using the
 * already-parsed HAST tree.
 *
 * mermaid.ink prepends a separate <style xmlns="..."> element containing only
 * a Font Awesome @import before the actual diagram <style> block. Selecting
 * the first <style> therefore returns the wrong block. We select by longest
 * text content, which reliably identifies the diagram CSS regardless of order.
 *
 * The Worker path produces a single <style> element so the longest-wins
 * strategy is also safe there (no behaviour change).
 *
 * Accepts the already-parsed HAST root to avoid a redundant re-parse of the
 * raw SVG string.
 */
function extractStyleText(root: HastRoot): string {
  const svgEl = select("svg", root);
  if (!svgEl || svgEl.type !== "element") return "";
  let best = "";
  for (const child of svgEl.children) {
    if (
      child.type === "element" &&
      child.tagName === "style" &&
      child.children.length > 0
    ) {
      const first = child.children[0];
      if (first && first.type === "text" && first.value.length > best.length) {
        best = first.value;
      }
    }
  }
  return best;
}

function stripStyleElements(svgEl: HastElement): void {
  svgEl.children = svgEl.children.filter(
    (child) => !(child.type === "element" && child.tagName === "style"),
  );
}

/**
 * Remove all occurrences of `#<renderId>` (with optional trailing space)
 * from a CSS string, making the rules class-only.
 */
function stripRenderId(css: string, renderId: string): string {
  if (!renderId) return css;
  const escaped = renderId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css
    .replace(new RegExp(`#${escaped}\\s+`, "g"), "")
    .replace(new RegExp(`#${escaped}(?=[{,\\s]|$)`, "g"), "");
}

async function scopeCss(
  rawCss: string,
  scopePrefix: string,
): Promise<{ scoped: string; keyframes: string[] }> {
  if (!rawCss.trim()) return { scoped: "", keyframes: [] };

  const keyframes: string[] = [];

  const plugin = (root: postcss.Root) => {
    root.walkAtRules("keyframes", (atRule) => {
      keyframes.push(atRule.toString());
      atRule.remove();
    });

    root.walkRules((rule) => {
      rule.selectors = rule.selectors.map((sel) => {
        const trimmed = sel.trim();
        if (trimmed.startsWith(scopePrefix)) return trimmed;
        if (trimmed === "" || trimmed === "svg") return scopePrefix;
        return `${scopePrefix} ${trimmed}`;
      });
    });
  };

  const result = await postcss([plugin]).process(rawCss, { from: undefined });
  return { scoped: result.css, keyframes };
}

function injectStyleBlock(svgEl: HastElement, css: string): void {
  if (!css.trim()) return;
  svgEl.children.unshift({
    type: "element",
    tagName: "style",
    properties: {},
    children: [{ type: "text", value: css }],
  });
}

/**
 * Normalises the SVG root element's intrinsic size.
 *
 * Mermaid (both the Cloudflare Worker and mermaid.ink) emits SVGs with
 * `width="100%"` and `style="max-width:<Xpx>"` to produce a responsive layout.
 * This representation has no concrete intrinsic pixel width: CSS `width: auto`
 * on a block-level SVG without a pixel width resolves to "fill available space"
 * rather than to the diagram's natural dimensions, which prevents the popover
 * scroll container from computing its max-content size correctly.
 *
 * This function reads the concrete width and height from the `viewBox` attribute
 * and writes them back as pixel values on the `width` and `height` properties.
 * The `max-width` inline style is removed because it is now superseded by the
 * explicit pixel width attribute.
 *
 * Only runs when the current `width` property is percentage-based or absent.
 * SVGs that already carry pixel dimensions (e.g. from a future renderer change)
 * are left untouched.
 */
function normalizesvgIntrinsicSize(svgEl: HastElement): void {
  const viewBox = svgEl.properties?.viewBox;
  if (typeof viewBox !== "string") return;

  // Skip if the SVG already has a concrete pixel width.
  const currentWidth = svgEl.properties?.width;
  const needsNormalization =
    currentWidth === undefined ||
    currentWidth === null ||
    (typeof currentWidth === "string" && currentWidth.includes("%"));
  if (!needsNormalization) return;

  // Parse the viewBox — format is "minX minY width height".
  const parts = viewBox.trim().split(/[\s,]+/);
  const w = parseFloat(parts[2] ?? "");
  const h = parseFloat(parts[3] ?? "");
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return;

  svgEl.properties = {
    ...svgEl.properties,
    width: String(w),
    height: String(h),
  };

  // Strip `max-width` from the inline style attribute — it was Mermaid's proxy
  // for the diagram's natural width and is no longer needed now that explicit
  // pixel attributes are present.
  if (typeof svgEl.properties.style === "string") {
    const cleaned = (svgEl.properties.style as string)
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d.length > 0 && !d.toLowerCase().startsWith("max-width"))
      .join("; ");

    if (cleaned) {
      svgEl.properties.style = cleaned;
    } else {
      const rest = { ...svgEl.properties };
      delete rest.style;
      svgEl.properties = rest;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker strategy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merges multiple per-theme SVGs produced by the Cloudflare Worker into a
 * single HAST <svg> with scoped multi-theme CSS.
 */
export async function buildMergedThemeNodeWorker(
  themes: Map<string, string>,
  stableId: string,
): Promise<HastElement> {
  const targetId = `mermaid-${stableId}`;
  const themeEntries = Array.from(themes.entries());

  if (themeEntries.length === 0) {
    throw new Error(
      `[mermaid:transform:worker] No themes provided for "${stableId}"`,
    );
  }

  // Parse all themed SVGs once — both the HAST tree and the style text are
  // derived from the same parse result to avoid a second parse per theme.
  const parsed = themeEntries.map(([name, rawSvg]) => {
    const root = parseSvgToHast(rawSvg);
    return {
      name,
      rawSvg,
      root,
      renderId: extractSvgId(rawSvg),
      rawCss: extractStyleText(root),
    };
  });

  // Scope CSS for each theme
  const allKeyframeStrings = new Set<string>();
  const allScopedBlocks: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i]!;
    if (!entry.rawCss.trim()) continue;

    const strippedCss = entry.renderId
      ? stripRenderId(entry.rawCss, entry.renderId)
      : entry.rawCss;
    const { rootBlocks, otherCss } = splitRootRules(strippedCss);

    const isBase = i === 0;
    const scopePrefix = isBase
      ? `#${targetId}`
      : `[data-theme="${entry.name}"] #${targetId}`;

    if (isBase) {
      rootBlocks.forEach((b) => allKeyframeStrings.add(b));
    }

    const { scoped, keyframes } = await scopeCss(otherCss, scopePrefix);
    keyframes.forEach((k) => allKeyframeStrings.add(k));
    if (scoped.trim()) allScopedBlocks.push(scoped);
  }

  // Build the base HAST tree from the first (light) theme's already-parsed root
  const baseEntry = parsed[0]!;
  const baseRoot = baseEntry.root;

  stripScripts(baseRoot);
  sanitizeStyleAttributes(baseRoot);
  collapseForeignObjectLineBreaks(baseRoot);
  updateHastIds(baseRoot, baseEntry.renderId, targetId);

  const svgEl = select("svg", baseRoot);
  if (!svgEl || svgEl.type !== "element") {
    throw new Error(
      `[mermaid:transform:worker] Could not extract <svg> for "${stableId}"`,
    );
  }
  stripStyleElements(svgEl);
  normalizesvgIntrinsicSize(svgEl);

  const mergedCss = [
    ...Array.from(allKeyframeStrings),
    ...allScopedBlocks,
  ].join("\n");

  injectStyleBlock(svgEl, mergedCss);
  return svgEl;
}

// ─────────────────────────────────────────────────────────────────────────────
// mermaid.ink strategy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fixed root id mermaid.ink always uses — it is NOT a dynamic render id.
 * CSS inside the SVG is already scoped to this literal string.
 */
const MERMAID_INK_ROOT_ID = "mermaid-svg";

/**
 * Transforms per-theme SVGs from mermaid.ink into a single HAST <svg> element
 * with CSS re-scoped and merged for all themes.
 *
 * Key difference from the Worker path: mermaid.ink places classDef colours
 * ONLY as inline style attributes on node elements — they are absent from the
 * <style> block.  hoistInlineColorsToCss() converts them to proper CSS rules
 * and strips the inline declarations, enabling the cascade to work correctly.
 *
 * mermaid.ink also prepends a Font Awesome @import as the first <style>
 * element. extractStyleText uses longest-content selection to skip it and
 * return the actual diagram CSS.
 */
export async function buildMergedThemeNodeInk(
  themes: Map<string, string>,
  stableId: string,
): Promise<HastElement> {
  const targetId = `mermaid-${stableId}`;
  const themeEntries = Array.from(themes.entries());

  if (themeEntries.length === 0) {
    throw new Error(
      `[mermaid:transform:ink] No themes provided for "${stableId}"`,
    );
  }

  const allKeyframeStrings = new Set<string>();
  const allScopedBlocks: string[] = [];

  // Parse all theme SVGs upfront. hoistInlineColorsToCss mutates the tree in
  // place, so each theme needs its own independent parse result. Style text
  // is extracted from the same parse — no second parse per theme.
  const parsedThemes = themeEntries.map(([name, rawSvg]) => {
    const root = parseSvgToHast(rawSvg);
    return { name, rawSvg, root, rawCss: extractStyleText(root) };
  });

  for (let i = 0; i < parsedThemes.length; i++) {
    const { name: themeName, root: themeRoot, rawCss } = parsedThemes[i]!;

    const isBase = i === 0;
    const scopePrefix = isBase
      ? `#${targetId}`
      : `[data-theme="${themeName}"] #${targetId}`;

    // Rename before hoisting so generated ID-specific CSS points at the final
    // SVG ids, not mermaid.ink's fixed `mermaid-svg-*` ids.
    updateHastIds(themeRoot, MERMAID_INK_ROOT_ID, targetId);

    // Step 1 — Hoist classDef inline colour styles into CSS rules.
    // This also strips the colour declarations from the inline style attributes
    // on the parsed tree (themeRoot is mutated here).
    const hoistedCss = hoistInlineColorsToCss(themeRoot, scopePrefix);
    if (hoistedCss.trim()) allScopedBlocks.push(hoistedCss);

    // Step 2 — Scope the regular <style> CSS block extracted from the same
    // parse pass above. extractStyleText picks the largest <style> block,
    // skipping the Font Awesome @import mermaid.ink prepends.
    if (rawCss.trim()) {
      const strippedCss = stripRenderId(rawCss, MERMAID_INK_ROOT_ID);
      const { rootBlocks, otherCss } = splitRootRules(strippedCss);

      // :root blocks only from the first theme (once is enough)
      if (isBase) {
        rootBlocks.forEach((b) => allKeyframeStrings.add(b));
      }

      const { scoped, keyframes } = await scopeCss(otherCss, scopePrefix);
      keyframes.forEach((k) => allKeyframeStrings.add(k));
      if (scoped.trim()) allScopedBlocks.push(scoped);
    }
  }

  // Build the final SVG from the base (first) theme's mutated tree.
  // hoistInlineColorsToCss has already stripped colour inline styles from it.
  const baseEntry = parsedThemes[0]!;
  const baseRoot = baseEntry.root;

  stripScripts(baseRoot);
  sanitizeStyleAttributes(baseRoot);
  collapseForeignObjectLineBreaks(baseRoot);

  const svgEl = select("svg", baseRoot);
  if (!svgEl || svgEl.type !== "element") {
    throw new Error(
      `[mermaid:transform:ink] Could not extract <svg> for "${stableId}" (rawSvg len=${baseEntry.rawSvg.length})`,
    );
  }

  stripStyleElements(svgEl);
  normalizesvgIntrinsicSize(svgEl);

  const mergedCss = [
    ...Array.from(allKeyframeStrings),
    ...allScopedBlocks,
  ].join("\n");

  injectStyleBlock(svgEl, mergedCss);
  return svgEl;
}

/**
 * Separates `:root { ... }` blocks from the rest of a CSS string using the
 * PostCSS AST walker. This handles nested braces and comments correctly,
 * unlike a simple regex approach.
 *
 * mermaid.ink embeds `:root { --mermaid-font-family: ... }` which must NOT
 * be scoped under `#<id>` — scoping `:root` has no effect and produces
 * invalid output like `#mermaid-abc :root { }`.
 */
function splitRootRules(css: string): {
  rootBlocks: string[];
  otherCss: string;
} {
  if (!css.trim()) return { rootBlocks: [], otherCss: css };

  const rootBlocks: string[] = [];
  const root = postcss.parse(css);

  root.walkRules((rule) => {
    if (rule.selector.trim() === ":root") {
      rootBlocks.push(rule.toString());
      rule.remove();
    }
  });

  return { rootBlocks, otherCss: root.toString() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service-aware dispatcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatches to the correct transform strategy based on which rendering
 * service produced the SVGs.
 */
export async function buildMergedThemeNode(
  themes: Map<string, string>,
  stableId: string,
  service: import("./types.ts").RenderService,
): Promise<HastElement> {
  switch (service) {
    case RenderService.CloudflareWorker:
      return buildMergedThemeNodeWorker(themes, stableId);

    case RenderService.MermaidInk:
      return buildMergedThemeNodeInk(themes, stableId);

    case RenderService.Cache:
      // Cache hits are resolved in DiagramPipeline.prepareDiagrams before
      // buildMergedThemeNode is ever called. Reaching this branch means the
      // caller incorrectly passed a cache-sourced service value into the
      // transform — throw loudly so the bug is immediately visible.
      throw new Error(
        `[mermaid:transform] Cache hit reached transform for "${stableId}". ` +
          "Cache resolution must be handled before buildMergedThemeNode is called.",
      );

    case RenderService.FailurePlaceholder:
      throw new Error(
        `[mermaid:transform] Attempted to transform a failure-placeholder for "${stableId}". ` +
          "This SVG should have been replaced with a fallback node before reaching transform.",
      );

    default: {
      const _exhaustive: never = service;
      throw new Error(
        `[mermaid:transform] Unknown RenderService: ${String(_exhaustive)}`,
      );
    }
  }
}
