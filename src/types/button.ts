/**
 * Button type contract for the <Button> primitive.
 *
 * Reconciliation note (ticket BUI-002): these unions are ported verbatim from
 * the source project's `src/types/button.ts`. They carry the DaisyUI `btn-`
 * prefix so the <Button> component can apply a member directly as a class
 * (e.g. `class:list={["btn", variant, size]}`) with no lookup table. This is
 * the authoritative shape both applications and bloomwright-mdx compile against.
 *
 * - `ButtonVariant` includes `btn-outline` (a modifier the source treats as a
 *   first-class variant) and every DaisyUI semantic color.
 * - `ButtonSize` covers `btn-xs … btn-lg`; the source does not use `btn-xl`.
 */
export type ButtonVariant =
  | "btn-neutral"
  | "btn-primary"
  | "btn-secondary"
  | "btn-accent"
  | "btn-info"
  | "btn-success"
  | "btn-warning"
  | "btn-error"
  | "btn-ghost"
  | "btn-link"
  | "btn-outline";

export type ButtonSize = "btn-xs" | "btn-sm" | "btn-md" | "btn-lg";
