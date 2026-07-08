import { registerEChartSvgArtifact } from "./artifacts.ts";
import type {
  ChartHydrationMode,
  ChartRenderMode,
  DeferredChartHydrationMode,
  DeferredChartRenderMode,
} from "./component.ts";
import {
  normalizeChartHydration,
  normalizeChartRenderMode,
} from "./component.ts";
import type { ChartClientPreset } from "./client-presets.ts";
import type { ChartOption, ChartTheme } from "./registry.ts";
import { renderEChartSvg, withChartAriaDefaults } from "./server.ts";
import { chartHash, serializeChartOption } from "./serialization.ts";

export interface EChartRenderInput {
  option: ChartOption;
  width?: number | undefined;
  height?: number | undefined;
  render?: ChartRenderMode | DeferredChartRenderMode | undefined;
  hydrate?: ChartHydrationMode | DeferredChartHydrationMode | undefined;
  title?: string | undefined;
  caption?: string | undefined;
  description?: string | undefined;
  className?: string | undefined;
  id?: string | undefined;
  enhance?: ChartHydrationMode | undefined;
  media?: string | undefined;
  theme?: ChartTheme | undefined;
  aria?: Record<string, unknown> | undefined;
  cacheKey?: string | undefined;
  optionClientPreset?: ChartClientPreset | undefined;
  clientOption?: ChartOption | undefined;
}

export interface RenderedEChartMarkup {
  html: string;
  shouldEnhance: boolean;
  chartId: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attr(name: string, value: unknown): string {
  if (value === undefined || value === null || value === false) return "";
  return ` ${name}="${escapeHtml(String(value))}"`;
}

function classAttr(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function renderEChartMarkup(
  input: EChartRenderInput,
): RenderedEChartMarkup {
  const width = input.width ?? 760;
  const height = input.height ?? 420;
  const renderMode = normalizeChartRenderMode(input.render);
  const hydrationMode = normalizeChartHydration({
    hydrate: input.hydrate,
    enhance: input.enhance,
    media: input.media,
  });
  const accessibleDescription =
    input.description ?? input.title ?? input.caption ?? "Chart";
  const renderOption = withChartAriaDefaults(
    input.option,
    accessibleDescription,
    input.aria,
  );
  const chartId =
    input.id ??
    `echart-${chartHash({
      option: renderOption,
      width,
      height,
      render: renderMode,
      hydrate: hydrationMode,
      theme: input.theme,
      cacheKey: input.cacheKey,
      title: input.title,
      caption: input.caption,
      description: accessibleDescription,
    })}`;
  const captionId = `${chartId}-caption`;
  const hasCaption = Boolean(input.title || input.caption);
  const shouldEnhance = hydrationMode !== "none";
  const enhancedOption = shouldEnhance
    ? withChartAriaDefaults(
        input.clientOption ?? input.option,
        accessibleDescription,
        input.aria,
      )
    : null;
  const serializedOption = enhancedOption
    ? serializeChartOption(enhancedOption)
    : undefined;
  const serializedTheme =
    shouldEnhance && input.theme !== undefined
      ? serializeChartOption(input.theme)
      : undefined;
  const artifact =
    renderMode === "svg-file"
      ? registerEChartSvgArtifact({
          option: renderOption,
          width,
          height,
          theme: input.theme,
          cacheKey: input.cacheKey,
        })
      : null;
  const assetHref = artifact && !artifact.svg ? artifact.href : undefined;
  const svg =
    artifact?.svg ??
    (assetHref
      ? undefined
      : renderEChartSvg({
          option: renderOption,
          width,
          height,
          theme: input.theme,
        }));
  const surfaceStyle = `--echart-width:${width}px;--echart-height:${height}px;--echart-aspect-ratio:${width} / ${height};`;

  const captionHtml = hasCaption
    ? [
        `<figcaption${attr("id", captionId)} class="echart-caption">`,
        input.title ? `<strong>${escapeHtml(input.title)}</strong>` : "",
        input.title && input.caption
          ? '<span aria-hidden="true"> - </span>'
          : "",
        input.caption ? `<span>${escapeHtml(input.caption)}</span>` : "",
        "</figcaption>",
      ].join("")
    : "";

  const surfaceHtml = assetHref
    ? [
        `<div${attr("id", chartId)} class="echart-surface"${attr("style", surfaceStyle)} data-echart-surface>`,
        `<img class="echart-static-image"${attr("src", assetHref)}${attr("width", width)}${attr("height", height)}${attr("alt", accessibleDescription)} loading="lazy" decoding="async">`,
        "</div>",
      ].join("")
    : [
        `<div${attr("id", chartId)} class="echart-surface"${attr("style", surfaceStyle)} role="img"${attr("aria-label", accessibleDescription)} data-echart-surface>`,
        svg ?? "",
        "</div>",
      ].join("");

  const html = [
    `<echart-shell class="${escapeHtml(classAttr("echart-wrapper", "not-prose", input.className))}"`,
    attr("data-chart-render", renderMode),
    attr("data-chart-hydrate", hydrationMode),
    attr("data-chart-enhance", hydrationMode),
    attr(
      "data-chart-media",
      hydrationMode === "media" ? input.media : undefined,
    ),
    attr("data-chart-option", serializedOption),
    attr("data-chart-theme", serializedTheme),
    attr("data-chart-option-client-preset", input.optionClientPreset),
    attr("data-chart-width", width),
    attr("data-chart-height", height),
    attr("data-enhanced", shouldEnhance ? "false" : undefined),
    ">",
    `<figure class="echart-figure"${attr("aria-describedby", hasCaption ? captionId : undefined)}>`,
    captionHtml,
    surfaceHtml,
    "</figure>",
    "</echart-shell>",
  ].join("");

  return { html, shouldEnhance, chartId };
}
