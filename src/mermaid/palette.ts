/**
 * palette.ts
 *
 * Conversion reference (OKLCH → sRGB hex, D65 illuminant):
 *   Light primary:  oklch(0.5434 0.174  29.69) → #b83a2a
 *   Dark  primary:  oklch(0.5333 0.2151 28.10) → #bf3020
 *
 * fontFamily uses "Inter, sans-serif" to match the UI font exposed through
 * --font-sans. Inter is loaded via the raw --font-inter variable on every
 * page, so inline SVGs rendered by both the Cloudflare Worker and mermaid.ink
 * will use Inter when displayed in the browser regardless of whether the
 * render service has the font installed server-side.
 */

import type { MermaidPalette } from "./types.ts";

export const LIGHT_PALETTE: MermaidPalette = {
  // ── Surfaces ─────────────────────────────────────────────────────────────
  base100: "#ffffff", // oklch(1 0.0001 263.28)
  base200: "#f4f4f5", // oklch(0.9551 0.0001 263.28)
  base300: "#e1e1e3", // oklch(0.8945 0.0001 263.28)
  baseContent: "#37373a", // oklch(0.2221 0.0001 263.28)

  // ── Brand ─────────────────────────────────────────────────────────────────
  primary: "#b83a2a", // oklch(0.5434 0.174 29.69)
  primaryContent: "#ffffff", // oklch(1 0.0001 263.28)
  secondary: "#d4933a", // oklch(0.7628 0.1626 69.36)
  secondaryContent: "#37373a", // oklch(0.2221 0.0001 263.28)
  accent: "#e8b96a", // oklch(0.8338 0.1248 66.87)
  accentContent: "#37373a", // oklch(0.2221 0.0001 263.28)
  neutral: "#d8d8da", // oklch(0.8576 0.0001 263.28)
  neutralContent: "#37373a", // oklch(0.2221 0.0001 263.28)

  // ── Semantic ──────────────────────────────────────────────────────────────
  info: "#3b82c4", // oklch(0.6531 0.1348 242.7)
  success: "#2da870", // oklch(0.6629 0.1602 152.39)
  warning: "#c9a530", // oklch(0.8358 0.1689 91.77)
  error: "#c13228", // oklch(0.6307 0.194 29.43)

  // ── Borders ───────────────────────────────────────────────────────────────
  border: "#d8d8da",
  mutedBorder: "#e8e8ea",

  // ── Subtle surfaces ───────────────────────────────────────────────────────
  subtleSurface: "#f8f8f9",
  subtleSurface2: "#ededef",

  // ── Gantt ─────────────────────────────────────────────────────────────────
  ganttActiveTaskBkg: "#fde8c8",
  ganttActiveTaskBorder: "#d4933a",
  ganttDoneTaskBkg: "#d1eddb",
  ganttDoneTaskBorder: "#2da870",
  ganttCritBkg: "#fcd4d1",
  ganttCritBorder: "#c13228",
  ganttExcludeBkg: "#ededef",
  ganttGridColor: "#d8d8da",
  ganttTodayLineColor: "#b83a2a",

  // ── Typography & mode ─────────────────────────────────────────────────────
  darkMode: false,
  // Inter matches the UI font stack loaded through --font-inter.
  // The browser resolves this font-family declaration when displaying the
  // inlined SVG, so Inter is used even though neither mermaid.ink nor the
  // Cloudflare Worker has the font installed server-side.
  fontFamily: "Inter, sans-serif",
  fontSize: "14px",
};

export const DARK_PALETTE: MermaidPalette = {
  // ── Surfaces ─────────────────────────────────────────────────────────────
  base100: "#21212a", // oklch(0.15 0.0001 263.28)
  base200: "#363640", // oklch(0.2393 0.0001 263.28)
  base300: "#464652", // oklch(0.3092 0.0001 263.28)
  baseContent: "#e9e9ea", // oklch(0.928 0.0001 263.28)

  // ── Brand ─────────────────────────────────────────────────────────────────
  primary: "#bf3020", // oklch(0.5333 0.2151 28.10)
  primaryContent: "#ffffff", // oklch(1 0.0001 263.28)
  secondary: "#d4933a", // oklch(0.7628 0.1626 69.36)
  secondaryContent: "#21212a", // oklch(0.15 0.0021 286.01)
  accent: "#e8b96a", // oklch(0.8338 0.1248 66.87)
  accentContent: "#21212a", // oklch(0.15 0.0021 286.01)
  neutral: "#414149", // oklch(0.285 0.0001 263.28)
  neutralContent: "#e9e9ea", // oklch(0.928 0.0001 263.28)

  // ── Semantic ──────────────────────────────────────────────────────────────
  info: "#3b82c4",
  success: "#2da870",
  warning: "#c9a530",
  error: "#c13228",

  // ── Borders ───────────────────────────────────────────────────────────────
  border: "#414149",
  mutedBorder: "#4e4e58",

  // ── Subtle surfaces ───────────────────────────────────────────────────────
  subtleSurface: "#2c2c36",
  subtleSurface2: "#2a2a34",

  // ── Gantt ─────────────────────────────────────────────────────────────────
  ganttActiveTaskBkg: "#4a3520",
  ganttActiveTaskBorder: "#d4933a",
  ganttDoneTaskBkg: "#1e3d2c",
  ganttDoneTaskBorder: "#2da870",
  ganttCritBkg: "#4a1e1a",
  ganttCritBorder: "#c13228",
  ganttExcludeBkg: "#2a2a34",
  ganttGridColor: "#464652",
  ganttTodayLineColor: "#bf3020",

  // ── Typography & mode ─────────────────────────────────────────────────────
  darkMode: true,
  // See LIGHT_PALETTE comment — same rationale applies here.
  fontFamily: "Inter, sans-serif",
  fontSize: "14px",
};
