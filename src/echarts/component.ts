export type ChartHydrationMode = "none" | "load" | "idle" | "visible" | "media";
export type ChartRenderMode = "svg-inline" | "svg-file";
export type DeferredChartHydrationMode = "light";
export type DeferredChartRenderMode = "png-file";

export interface NormalizeChartHydrationArgs {
  hydrate?: ChartHydrationMode | DeferredChartHydrationMode | undefined;
  enhance?: ChartHydrationMode | undefined;
  media?: string | undefined;
}

export function normalizeChartRenderMode(
  render: ChartRenderMode | DeferredChartRenderMode | undefined,
): ChartRenderMode {
  const mode = render ?? "svg-inline";

  if (mode === "png-file") {
    throw new Error(
      'EChart render="png-file" is deferred. Use render="svg-inline" or render="svg-file".',
    );
  }

  if (mode !== "svg-inline" && mode !== "svg-file") {
    throw new Error(
      `Unsupported EChart render mode "${mode}". Use "svg-inline" or "svg-file".`,
    );
  }

  return mode;
}

export function normalizeChartHydration({
  hydrate,
  enhance,
  media,
}: NormalizeChartHydrationArgs): ChartHydrationMode {
  if (hydrate && enhance && hydrate !== enhance) {
    throw new Error(
      `EChart hydrate="${hydrate}" conflicts with legacy enhance="${enhance}". Use one mode.`,
    );
  }

  const mode = hydrate ?? enhance ?? "none";

  if (mode === "light") {
    throw new Error(
      'EChart hydrate="light" is deferred. Use "none", "load", "idle", "visible", or "media".',
    );
  }

  if (
    mode !== "none" &&
    mode !== "load" &&
    mode !== "idle" &&
    mode !== "visible" &&
    mode !== "media"
  ) {
    throw new Error(
      `Unsupported EChart hydration mode "${mode}". Use "none", "load", "idle", "visible", or "media".`,
    );
  }

  if (mode === "media" && !media) {
    throw new Error('EChart hydrate="media" requires a media query string.');
  }

  return mode;
}
