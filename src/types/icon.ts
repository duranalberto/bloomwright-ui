/**
 * Icon — the shared inline-SVG descriptor used by SVGIcon, Button, Callout, and
 * (in bloomwright-mdx) the DaisyUI markup renderer.
 *
 * This type is the canonical contract owned by bloomwright-ui. bloomwright-mdx imports it
 * from here so fenced markup and rendered components agree on icon shape.
 *
 * Ported verbatim from the source project's `src/types/icon.ts`.
 */
export interface Icon {
  text: string;
  viewBox: string;
  content: string;
  isFile?: boolean;
  width?: number | string;
  height?: number | string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeLinecap?: "round" | "butt" | "square";
  strokeLinejoin?: "round" | "inherit" | "miter" | "bevel";
}

export interface RibbonIcon {
  iconSize: number;
  gap: number;
  verticalPadding?: number;
}
