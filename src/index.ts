/**
 * bloomwright-ui — public barrel (types + pure logic).
 *
 * Astro components are imported by path (see the `exports` map / README), not
 * from this barrel. This entry exposes the tree-shakeable type + logic surface
 * that both applications and bloomwright-mdx consume.
 *
 * The logic layer is the seam with bloomwright-mdx: components render it as
 * `.astro`; bloomwright-mdx renders it as HTML strings. One implementation
 * guarantees byte-for-byte parity.
 */

// ── Shared types (contracts) ────────────────────────────────────────────────
export type { Icon, RibbonIcon } from "./types/icon.ts";
export type { ButtonVariant, ButtonSize } from "./types/button.ts";

// ── Pure domain logic (source of truth; mirrored by bloomwright-mdx markup) ────────
export * from "./logic/callout.ts";
export * from "./logic/chat.ts";
export * from "./logic/list.ts";
export * from "./logic/steps.ts";
export * from "./logic/section-header.ts";
export * from "./logic/code-block.ts";
export * from "./logic/heading-anchor.ts";
