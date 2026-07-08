import type {
  Element as HastElement,
  Parent as HastParent,
  Root as HastRoot,
  Text as HastText,
} from "hast";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";

export function createHastElement(
  tagName: string,
  properties: Record<string, any> = {},
  children: (HastElement | HastText)[] = [],
): HastElement {
  return { type: "element", tagName, properties, children };
}

/**
 * Removes <script> tags from the HAST tree for security.
 */
export function stripScripts(tree: HastRoot | HastElement): void {
  visit(
    tree,
    "element",
    (node: HastElement, index, parent: HastParent | undefined) => {
      if (node.tagName === "script" && parent && typeof index === "number") {
        parent.children.splice(index, 1);
      }
    },
  );
}

/**
 * Cleans style attributes while preserving !important declarations.
 */
export function sanitizeStyleAttributes(tree: HastRoot | HastElement): void {
  visit(tree, "element", (node: HastElement) => {
    if (node.properties?.style && typeof node.properties.style === "string") {
      const cleaned = node.properties.style
        .split(";")
        .map((d) => d.trim())
        .filter((d) => d.length > 0 && d.includes(":"))
        .join("; ");

      if (cleaned) {
        node.properties.style = cleaned;
      } else {
        delete node.properties.style;
      }
    }
  });
}

function collapseBreakRuns(parent: HastParent): void {
  let previousWasBreak = false;
  const nextChildren: HastParent["children"] = [];

  for (const child of parent.children) {
    const isBreak = child.type === "element" && child.tagName === "br";

    if (isBreak) {
      child.children = [];
      if (!previousWasBreak) nextChildren.push(child);
      previousWasBreak = true;
      continue;
    }

    previousWasBreak =
      child.type === "text" && child.value.trim() === ""
        ? previousWasBreak
        : false;

    if (child.type === "element") collapseBreakRuns(child);
    nextChildren.push(child);
  }

  parent.children = nextChildren;
}

/**
 * Browser HTML parsing treats serialized SVG/XHTML `<br></br>` as two line
 * breaks. Some render services already emit repeated break nodes for Mermaid
 * HTML labels, so after HAST parsing and serialization those labels can expand
 * from one intended line break into four visible breaks. Collapse consecutive
 * `<br>` elements inside SVG foreignObject labels back to a single break.
 */
export function collapseForeignObjectLineBreaks(
  tree: HastRoot | HastElement,
): void {
  visit(tree, "element", (node: HastElement) => {
    if (node.tagName === "foreignObject") collapseBreakRuns(node);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Ink-specific: hoist classDef inline colour styles into scoped CSS rules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSS properties that mermaid.ink bakes into inline style attributes when
 * classDef blocks are applied to nodes.  These need to be lifted into the
 * scoped <style> block so that:
 *  a) Base-theme colours survive as CSS rules rather than as inline styles.
 *  b) Alternate-theme ([data-theme="X"]) overrides can beat them via higher
 *     specificity, since the inline declarations will have been removed.
 */
const COLOR_STYLE_PROPS = new Set([
  "fill",
  "stroke",
  "color",
  "background",
  "background-color",
  "stroke-width",
  "stroke-dasharray",
]);

function stripImportant(value: string): string {
  return value.replace(/\s*!important/g, "").trim();
}

function parseColorDeclarations(styleStr: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const decl of styleStr.split(";")) {
    const colon = decl.indexOf(":");
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const val = stripImportant(decl.slice(colon + 1).trim());
    if (prop && val && COLOR_STYLE_PROPS.has(prop)) {
      result.set(prop, val);
    }
  }
  return result;
}

/**
 * Returns a CSS selector fragment identifying the child element within its
 * parent .node group.  Ordered most-specific first.
 */
function childSelector(el: HastElement): string {
  const tag = el.tagName;
  const classes: string[] = Array.isArray(el.properties?.className)
    ? (el.properties.className as string[])
    : typeof el.properties?.className === "string"
      ? el.properties.className.split(" ").filter(Boolean)
      : [];

  if (tag === "rect" && classes.includes("basic")) return "rect.basic";
  if (tag === "polygon" && classes.includes("label-container"))
    return "polygon.label-container";
  if (tag === "g" && classes.includes("label")) return "g.label";
  if (tag === "circle") return "circle";
  if (tag === "rect") return "rect";
  if (tag === "polygon") return "polygon";
  return tag + (classes[0] ? "." + classes[0] : "");
}

/**
 * Walks a parsed mermaid.ink SVG HAST tree and, for every `.node` group
 * whose direct children carry inline colour styles (fill, stroke, color …),
 * generates scoped CSS rules and removes those inline colour declarations.
 *
 * mermaid.ink places classDef colours *only* as inline style attributes —
 * they are absent from the SVG's embedded <style> block.  This function
 * converts them into proper CSS rules so that:
 *  - The base (light) theme colours come from CSS under `scopePrefix`.
 *  - Alternate themes use `[data-theme="X"] scopePrefix` rules with higher
 *    specificity, overriding the base rules cleanly.
 *  - No inline styles remain to fight the cascade.
 *
 * @param root        Parsed HAST tree (mutated in place — inline styles removed)
 * @param scopePrefix CSS scope prefix, e.g. `#mermaid-abc123` for the base
 *                    theme or `[data-theme="dark"] #mermaid-abc123` for dark
 * @returns           A CSS string of generated rules (may be empty string)
 *
 * ⚠️  Call this ONLY on SVGs produced by mermaid.ink.
 *     Worker-produced SVGs use CSS class-based theming and must not be
 *     processed by this function.
 */
export function hoistInlineColorsToCss(
  root: HastRoot | HastElement,
  scopePrefix: string,
): string {
  const rules: string[] = [];

  visit(root, "element", (node: HastElement) => {
    const classes: string[] = Array.isArray(node.properties?.className)
      ? (node.properties.className as string[])
      : typeof node.properties?.className === "string"
        ? node.properties.className.split(" ").filter(Boolean)
        : [];

    // Only process .node groups with an id
    if (!classes.includes("node")) return;
    const nodeId =
      typeof node.properties?.id === "string" ? node.properties.id : null;
    if (!nodeId) return;

    for (const child of node.children) {
      if (child.type !== "element") continue;

      const styleStr =
        typeof child.properties?.style === "string"
          ? child.properties.style
          : "";
      if (!styleStr) continue;

      const colorDecls = parseColorDeclarations(styleStr);
      if (colorDecls.size === 0) continue;

      // Build a CSS rule from the hoisted colour declarations.
      // Add !important so hoisted ID-specific rules beat the class-based
      // defaults from the Mermaid <style> block (e.g. .node rect { fill: … }).
      const sel = childSelector(child);
      const declarations = Array.from(colorDecls.entries())
        .map(([p, v]) => `  ${p}: ${v} !important;`)
        .join("\n");
      rules.push(`${scopePrefix} #${nodeId} ${sel} {\n${declarations}\n}`);

      // Strip colour properties from the inline style, keep non-colour ones
      const nonColorParts = styleStr
        .split(";")
        .map((d) => d.trim())
        .filter((d) => {
          if (!d.includes(":")) return false;
          const prop = d.split(":")[0]?.trim().toLowerCase() ?? "";
          return !COLOR_STYLE_PROPS.has(prop);
        })
        .join("; ");

      if (nonColorParts) {
        child.properties = { ...child.properties, style: nonColorParts };
      } else {
        const rest = { ...(child.properties ?? {}) };
        delete rest.style;
        child.properties = rest;
      }
    }
  });

  return rules.join("\n");
}

/**
 * Step 1: Parse SVG string to HAST using the SVG namespace.
 * This ensures attributes like viewBox and clipPath preserve their case.
 */
export function parseSvgToHast(svgString: string): HastRoot {
  return fromHtml(svgString, { fragment: true, space: "svg" });
}

/**
 * Step 2: AST-Based ID & Reference Updates.
 * Safely renames the Mermaid-generated ID and all internal references (url(#...)).
 *
 * Handles both dash-separated and underscore-separated child IDs.
 * mermaid.ink uses underscore as separator for marker IDs
 * (e.g. `mermaid-svg_flowchart-v2-pointEnd`) while the Cloudflare Worker
 * uses dash-separated render IDs. Both patterns are handled here so marker
 * `url(#...)` references stay in sync with their `<marker id="...">` elements.
 */
export function updateHastIds(
  tree: HastRoot | HastElement,
  oldId: string | null,
  newId: string,
): void {
  if (!oldId || oldId === newId) return;

  visit(tree, "element", (node: HastElement) => {
    if (!node.properties) return;

    // 1. Update the ID of the element itself
    if (typeof node.properties.id === "string") {
      if (node.properties.id === oldId) {
        node.properties.id = newId;
      } else if (
        node.properties.id.startsWith(`${oldId}-`) ||
        node.properties.id.startsWith(`${oldId}_`)
      ) {
        // Replace only the first occurrence (the oldId prefix) to preserve
        // the rest of the id (e.g. `_flowchart-v2-pointEnd`).
        node.properties.id = newId + node.properties.id.slice(oldId.length);
      }
    }

    // 2. Update attributes that reference IDs via url(#id)
    const refAttrs = [
      "fill",
      "stroke",
      "filter",
      "clipPath",
      "mask",
      "markerStart",
      "markerMid",
      "markerEnd",
    ];

    for (const attr of refAttrs) {
      const val = node.properties[attr];
      if (typeof val === "string" && val.includes(`#${oldId}`)) {
        node.properties[attr] = val.replaceAll(`#${oldId}`, `#${newId}`);
      }
    }

    // 3. Update href/xlinkHref for <use> or links
    const links = ["href", "xlinkHref"];
    for (const attr of links) {
      const val = node.properties[attr];
      if (typeof val === "string") {
        if (
          val === `#${oldId}` ||
          val.startsWith(`#${oldId}-`) ||
          val.startsWith(`#${oldId}_`)
        ) {
          node.properties[attr] = `#${newId}` + val.slice(`#${oldId}`.length);
        }
      }
    }
  });
}

/**
 * Utility to generate a flat list of elements to facilitate
 * positional diffing between two structurally identical trees.
 */
export function flattenElements(tree: HastRoot | HastElement): HastElement[] {
  const elements: HastElement[] = [];
  visit(tree, "element", (node: HastElement) => {
    elements.push(node);
  });
  return elements;
}
