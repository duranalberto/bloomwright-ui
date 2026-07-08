/**
 * heading-anchor.ts — shared shaping for the HeadingAnchor prose surface.
 *
 * Shared source of truth for two consumers (parity):
 *   1. `components/prose/HeadingAnchor.astro` — the standalone UI component,
 *      usable directly in `.astro` pages or as an MDX `h2`/`h3` component. It
 *      renders `resolveHeadingTag(as)` as its element.
 *   2. bloomwright-mdx's `createHeadingAnchorPlugin()` — a Sätteri HAST plugin
 *      that stamps `as="hN"` on the tagged heading levels so the single mapped
 *      component renders the correct element for each depth.
 */

/**
 * The element the HeadingAnchor component renders. `as` overrides; when omitted
 * it defaults to `h2` — which is why the plugin only needs to stamp deeper
 * levels (see HEADING_ANCHOR_TAGGED_LEVELS).
 */
export function resolveHeadingTag(as?: string): string {
  return as || "h2";
}

/**
 * Heading tags the Sätteri plugin stamps with an explicit `as`. `h2` is the
 * component default, so it does not need tagging; deeper levels do, so the one
 * mapped component knows its depth.
 */
export const HEADING_ANCHOR_TAGGED_LEVELS = ["h3"] as const;

export type HeadingAnchorTaggedLevel =
  (typeof HEADING_ANCHOR_TAGGED_LEVELS)[number];
