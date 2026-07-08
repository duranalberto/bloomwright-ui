/**
 * theme.ts
 *
 * Generates a complete Mermaid `themeVariables` object from a MermaidPalette.
 * Always paired with `theme: "base"` — the only Mermaid theme that allows
 * full token customisation.
 *
 * Token coverage (all groups from the Mermaid base theme spec):
 *   ✓ Global (darkMode, background, fontFamily, fontSize)
 *   ✓ Core node colours (primary / secondary / tertiary)
 *   ✓ Flowchart (node, cluster, edge, title)
 *   ✓ Sequence diagram (actors, activation, loops, labels, sequenceNumber)
 *   ✓ Pie chart (pie1–pie12, typography, strokes, opacity)
 *   ✓ Git graph (git0–git7, gitInv0–gitInv7, gitBranchLabel0–7)
 *   ✓ Gantt (active/done/crit/exclude, grid, today)
 *   ✓ Kanban
 *   ✓ Timeline / cScale (cScale0–11, cScaleLabel0–11, cScalePeer0–11)
 *   ✓ State diagram (altBackground)
 *   ✓ Class diagram (classText)
 *   ✓ User journey / mindmap (fillType0–fillType7)
 *   ✓ Requirement diagram
 *   ✓ Notes
 */

import type { MermaidPalette } from "./types.ts";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!hex || typeof hex !== "string") {
    throw new TypeError(
      `[mermaid:theme] hexToRgb received ${JSON.stringify(hex)}.`,
    );
  }
  const value = hex.replace("#", "").trim();
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const num = Number.parseInt(normalized, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function assertPalette(palette: MermaidPalette): void {
  const required: (keyof MermaidPalette)[] = [
    "base100",
    "base200",
    "base300",
    "baseContent",
    "primary",
    "primaryContent",
    "secondary",
    "secondaryContent",
    "accent",
    "neutral",
    "info",
    "success",
    "warning",
    "error",
    "border",
    "mutedBorder",
    "subtleSurface",
    "subtleSurface2",
    "darkMode",
    "fontFamily",
    "fontSize",
    "ganttActiveTaskBkg",
    "ganttActiveTaskBorder",
    "ganttDoneTaskBkg",
    "ganttDoneTaskBorder",
    "ganttCritBkg",
    "ganttCritBorder",
    "ganttExcludeBkg",
    "ganttGridColor",
    "ganttTodayLineColor",
  ];
  for (const key of required) {
    if (palette[key] === undefined || palette[key] === null) {
      throw new TypeError(
        `[mermaid:theme] Palette field "${key}" is ${String(palette[key])}.`,
      );
    }
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function mixHex(a: string, b: string, weight = 0.5): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    ca.r * (1 - w) + cb.r * w,
    ca.g * (1 - w) + cb.g * w,
    ca.b * (1 - w) + cb.b * w,
  );
}

function channelToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Nudges `foreground` toward white or black until it reaches `minRatio`
 * against `background`. Falls back to whichever extreme wins.
 */
function ensureContrast(
  foreground: string,
  background: string,
  minRatio = 4.5,
): string {
  if (contrastRatio(foreground, background) >= minRatio) return foreground;
  const target = luminance(background) < 0.45 ? "#ffffff" : "#111111";
  let candidate = foreground;
  for (let i = 0; i < 12; i++) {
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
    candidate = mixHex(candidate, target, 0.18);
  }
  return contrastRatio(target, background) >
    contrastRatio(foreground, background)
    ? target
    : foreground;
}

function contrastTextCandidate(background: string): string {
  return luminance(background) < 0.45 ? "#ffffff" : "#111111";
}

export function generateMermaidTheme(
  palette: MermaidPalette,
): Record<string, string | boolean> {
  assertPalette(palette);

  const {
    base100,
    base200,
    base300,
    baseContent,
    primary,
    primaryContent,
    secondary,
    secondaryContent,
    accent,
    neutral,
    info,
    success,
    warning,
    error,
    border,
    mutedBorder,
    subtleSurface,
    subtleSurface2,
    darkMode,
    fontFamily,
    fontSize,
  } = palette;

  const textOnBase = ensureContrast(baseContent, base100, 4.5);
  const textOnBase2 = ensureContrast(baseContent, base200, 4.5);
  const textOnBase3 = ensureContrast(baseContent, base300, 4.5);
  const textOnPrimary = ensureContrast(primaryContent, primary, 4.5);
  const textOnSecondary = ensureContrast(secondaryContent, secondary, 4.5);

  const labelBg = darkMode ? base200 : subtleSurface;
  const labelText = ensureContrast(baseContent, labelBg, 4.5);
  const lineColor = mixHex(baseContent, base100, darkMode ? 0.45 : 0.5);

  const ordinalBkg: string[] = [
    primary,
    secondary,
    info,
    success,
    warning,
    error,
    accent,
    neutral,
    mixHex(primary, base300, 0.4),
    mixHex(secondary, base300, 0.4),
    mixHex(info, base300, 0.4),
    mixHex(success, base300, 0.4),
  ];

  const cScaleBkg: string[] = [
    info, // 0: blue  (DaisyUI info)
    success, // 1: green (DaisyUI success)
    warning, // 2: amber (DaisyUI warning)
    primary, // 3: brand red
    secondary, // 4: brand amber
    mixHex(info, success, 0.5), // 5: teal  (info ↔ success blend)
    accent, // 6: light amber
    mixHex(info, darkMode ? base200 : base300, 0.35), // 7: muted blue
    mixHex(success, darkMode ? base200 : base300, 0.35), // 8: muted green
    mixHex(warning, darkMode ? base200 : base300, 0.35), // 9: muted amber
    mixHex(primary, darkMode ? base200 : base300, 0.4), // 10: muted red
    mixHex(secondary, darkMode ? base200 : base300, 0.35), // 11: muted amber
  ];

  // ── Git graph tokens ──────────────────────────────────────────────────────
  const gitTokens: Record<string, string> = {};
  for (let i = 0; i < 8; i++) {
    const bg = ordinalBkg[i] ?? primary;
    const inv = luminance(bg) >= 0.35 ? "#111111" : "#ffffff";
    gitTokens[`git${i}`] = bg;
    gitTokens[`gitInv${i}`] = inv;
    gitTokens[`gitBranchLabel${i}`] = ensureContrast(inv, bg, 4.5);
  }

  // ── Pie chart tokens ──────────────────────────────────────────────────────
  const pieTokens: Record<string, string> = {};
  for (let i = 0; i < 12; i++) {
    pieTokens[`pie${i + 1}`] = ordinalBkg[i] ?? primary;
  }

  // ── cScale tokens (timeline, kanban column headers, mindmap sections) ─────
  const cScaleTokens: Record<string, string> = {};
  for (let i = 0; i < 12; i++) {
    const bg = cScaleBkg[i] ?? primary;
    const textCandidate = contrastTextCandidate(bg);
    cScaleTokens[`cScale${i}`] = bg;
    cScaleTokens[`cScaleLabel${i}`] = ensureContrast(textCandidate, bg, 4.5);
    cScaleTokens[`cScalePeer${i}`] = mixHex(
      bg,
      darkMode ? "#000000" : "#ffffff",
      0.2,
    );
  }

  // ── User journey / mindmap fill tokens ────────────────────────────────────
  const fillTypeTokens: Record<string, string> = {};
  for (let i = 0; i < 8; i++) {
    fillTypeTokens[`fillType${i}`] = cScaleBkg[i] ?? primary;
  }

  // ── Kanban elevation ──────────────────────────────────────────────────────
  const kanbanCardBkg = darkMode ? base300 : base100;
  const kanbanCardText = ensureContrast(baseContent, kanbanCardBkg, 4.5);
  const kanbanBoardBkg = darkMode ? base100 : base300;

  const noteBg = darkMode
    ? mixHex(base300, warning, 0.12)
    : mixHex(base100, warning, 0.18);
  const errorBg = mixHex(error, base100, 0.3);
  const taskBg = mixHex(primary, base200, 0.25);
  const activationBg = mixHex(secondary, base200, 0.35);

  return {
    // ── Global ────────────────────────────────────────────────────────────
    darkMode,
    background: base100,
    fontFamily,
    fontSize,

    // ── Core node/arrow tokens ────────────────────────────────────────────
    primaryColor: primary,
    primaryTextColor: textOnPrimary,
    primaryBorderColor: mixHex(primary, darkMode ? "#000000" : "#ffffff", 0.2),
    secondaryColor: secondary,
    secondaryTextColor: textOnSecondary,
    secondaryBorderColor: mixHex(
      secondary,
      darkMode ? "#000000" : "#ffffff",
      0.2,
    ),
    tertiaryColor: base300,
    tertiaryTextColor: textOnBase3,
    tertiaryBorderColor: border,

    // ── Global text / line ────────────────────────────────────────────────
    textColor: textOnBase,
    lineColor,
    mainBkg: base200,

    // ── Error state ───────────────────────────────────────────────────────
    errorBkgColor: errorBg,
    errorTextColor: ensureContrast(error, errorBg, 4.5),

    // ── Flowchart ─────────────────────────────────────────────────────────
    nodeBkg: base200,
    nodeBorder: border,
    nodeTextColor: textOnBase2,
    clusterBkg: darkMode ? base300 : subtleSurface2,
    clusterBorder: border,
    clusterTextColor: textOnBase3,
    defaultLinkColor: lineColor,
    titleColor: textOnBase,
    edgeLabelBackground: labelBg,
    edgeLabelColor: labelText,

    // ── Sequence diagram ──────────────────────────────────────────────────
    actorBkg: base200,
    actorBorder: border,
    actorTextColor: textOnBase2,
    actorLineColor: border,
    signalColor: lineColor,
    signalTextColor: textOnBase,
    labelBoxBkgColor: base200,
    labelBoxBorderColor: border,
    labelTextColor: textOnBase2,
    loopTextColor: textOnBase,
    activationBkgColor: activationBg,
    activationBorderColor: secondary,
    sequenceNumberColor: textOnPrimary,

    // ── Pie chart ─────────────────────────────────────────────────────────
    ...pieTokens,
    pieTitleTextSize: "16px",
    pieTitleTextColor: textOnBase,
    pieSectionTextSize: "14px",
    pieSectionTextColor: textOnBase,
    pieLegendTextSize: "14px",
    pieLegendTextColor: textOnBase,
    pieStrokeColor: base100,
    pieStrokeWidth: "2px",
    pieOuterStrokeWidth: "2px",
    pieOuterStrokeColor: border,
    pieOpacity: "0.85",

    // ── Git graph ─────────────────────────────────────────────────────────
    ...gitTokens,
    commitLabelColor: textOnBase,
    commitLabelBackground: base100,
    commitLabelFontSize: "11px",
    tagLabelColor: textOnPrimary,
    tagLabelBackground: primary,
    tagLabelBorder: mixHex(primary, "#000000", 0.2),
    tagLabelFontSize: "11px",
    ...cScaleTokens,

    // ── Gantt ─────────────────────────────────────────────────────────────
    sectionBkgColor: base200,
    sectionBkgColor2: darkMode
      ? mixHex(base200, base300, 0.5)
      : mixHex(base200, base100, 0.5),
    sectionTextColor: textOnBase2,
    altSectionBkgColor: base300,
    altSectionTextColor: textOnBase3,
    taskBkgColor: taskBg,
    taskBorderColor: primary,
    taskTextColor: ensureContrast(baseContent, taskBg, 4.5),
    taskTextLightColor: textOnPrimary,
    taskTextDarkColor: textOnBase,
    taskTextOutsideColor: textOnBase,
    taskTextClickableColor: primary,
    activeTaskBkgColor: palette.ganttActiveTaskBkg,
    activeTaskBorderColor: palette.ganttActiveTaskBorder,
    doneTaskBkgColor: palette.ganttDoneTaskBkg,
    doneTaskBorderColor: palette.ganttDoneTaskBorder,
    critBkgColor: palette.ganttCritBkg,
    critBorderColor: palette.ganttCritBorder,
    excludeBkgColor: palette.ganttExcludeBkg,
    gridColor: palette.ganttGridColor,
    todayLineColor: palette.ganttTodayLineColor,

    // ── Kanban ────────────────────────────────────────────────────────────
    kanbanBoardBkgColor: kanbanBoardBkg,
    kanbanSectionBkgColor: base200,
    kanbanSectionTextColor: textOnBase2,
    kanbanTicketBkgColor: kanbanCardBkg,
    kanbanTicketTextColor: kanbanCardText,
    kanbanTicketBorderColor: border,

    // ── State diagram ─────────────────────────────────────────────────────
    labelColor: labelText,
    altBackground: base300,

    // ── Class diagram ─────────────────────────────────────────────────────
    classText: textOnBase,

    // ── Requirement diagram ───────────────────────────────────────────────
    requirementBackground: base200,
    requirementBorderColor: border,
    requirementTextColor: textOnBase2,
    requirementBorderSize: "1px",
    relationColor: lineColor,
    relationLabelBackground: labelBg,
    relationLabelColor: labelText,

    // ── Notes ─────────────────────────────────────────────────────────────
    noteBkgColor: noteBg,
    noteTextColor: ensureContrast(baseContent, noteBg, 4.5),
    noteBorderColor: mutedBorder,

    // ── User journey / mindmap ────────────────────────────────────────────
    ...fillTypeTokens,
  };
}
