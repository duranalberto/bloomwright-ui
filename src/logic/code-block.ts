/**
 * code-block.ts — shared shaping for the CodeBlock prose surface.
 *
 * Two consumers share this single source of truth so their output is identical
 * (the parity contract, mirroring the DaisyUI resolvers):
 *   1. `components/prose/CodeBlock.astro` — the standalone UI component, renders
 *      the wrapper structure around a `<slot/>` for direct use in `.astro` pages
 *      or as an MDX `pre` component.
 *   2. bloomwright-mdx's `createCodeBlockPlugin()` — a Sätteri HAST plugin that
 *      wraps the highlighted `<code>` HTML in the identical structure.
 */

/** The `mockup-code` wrapper classes for a highlighted code block. */
export const CODE_BLOCK_WRAPPER_CLASS =
  "mockup-code my-8 border border-base-300 shadow-2xl text-sm bg-base-200";

/**
 * Wrap already-highlighted `<code>…</code>` HTML in the mockup-code shell.
 * `CodeBlock.astro` renders the byte-identical structure with a `<slot/>` in
 * place of `innerHtml`.
 */
export function wrapCodeBlockHtml(innerHtml: string): string {
  return [
    '<div class="not-prose">',
    `<div class="${CODE_BLOCK_WRAPPER_CLASS}">`,
    '<div class="overflow-x-auto">',
    innerHtml,
    "</div>",
    "</div>",
    "</div>",
  ].join("");
}
