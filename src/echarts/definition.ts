import type { ChartHydrationMode, ChartRenderMode } from "./component.ts";
import {
  normalizeChartHydration,
  normalizeChartRenderMode,
} from "./component.ts";
import type { ChartClientPreset } from "./client-presets.ts";
import type { ChartOption, ChartTheme } from "./registry.ts";
import { assertSerializableChartOption } from "./serialization.ts";

export interface EChartFenceFigure {
  title?: string | undefined;
  caption?: string | undefined;
  description: string;
}

export interface EChartFenceSize {
  width?: number | undefined;
  height?: number | undefined;
}

export interface EChartFenceDefinition {
  version?: 1 | undefined;
  type: string;
  id?: string | undefined;
  class?: string | undefined;
  figure: EChartFenceFigure;
  size?: EChartFenceSize | undefined;
  render?: ChartRenderMode | "png-file" | undefined;
  hydrate?: ChartHydrationMode | "light" | undefined;
  media?: string | undefined;
  cacheKey?: string | undefined;
  theme?: ChartTheme | undefined;
  aria?: Record<string, unknown> | undefined;
  optionClientPreset?: ChartClientPreset | undefined;
  data?: Record<string, unknown> | undefined;
  option?: ChartOption | undefined;
  clientOption?: ChartOption | "same" | undefined;
  overrides?: ChartOption | undefined;
}

export interface NormalizedEChartDefinition {
  version: 1;
  type: string;
  id?: string | undefined;
  className?: string | undefined;
  figure: EChartFenceFigure;
  width: number;
  height: number;
  render: ChartRenderMode;
  hydrate: ChartHydrationMode;
  media?: string | undefined;
  cacheKey?: string | undefined;
  theme?: ChartTheme | undefined;
  aria?: Record<string, unknown> | undefined;
  optionClientPreset?: ChartClientPreset | undefined;
  data: Record<string, unknown>;
  option?: ChartOption | undefined;
  clientOption?: ChartOption | "same" | undefined;
  overrides?: ChartOption | undefined;
}

export interface EChartFenceParseContext {
  fileURL?: URL | undefined;
  fenceLang?: string | undefined;
}

const CLIENT_PRESETS = new Set(["currency", "percent", "financeOhlc"]);

function sourceLabel(context: EChartFenceParseContext = {}): string {
  const fence = context.fenceLang ?? "echart";
  const file = context.fileURL?.pathname;
  return file ? `${fence} fence in ${file}` : `${fence} fence`;
}

function fail(message: string, context?: EChartFenceParseContext): never {
  throw new Error(`[echarts] ${sourceLabel(context)}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(
  value: unknown,
  label: string,
  context?: EChartFenceParseContext,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") fail(`${label} must be a string.`, context);
  return value;
}

function assertFiniteNumbers(
  value: unknown,
  path: string,
  context?: EChartFenceParseContext,
  seen: WeakSet<object> = new WeakSet(),
): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(`${path} must be a finite number.`, context);
    }
    return;
  }

  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertFiniteNumbers(item, `${path}[${index}]`, context, seen);
    });
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    assertFiniteNumbers(item, `${path}.${key}`, context, seen);
  }
}

function parseJson(source: string, context?: EChartFenceParseContext): unknown {
  try {
    return JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`invalid JSON (${message}).`, context);
  }
}

export function parseEChartFenceDefinition(
  source: string,
  context: EChartFenceParseContext = {},
): NormalizedEChartDefinition {
  const parsed = parseJson(source, context);

  if (!isRecord(parsed)) {
    fail("definition must be a JSON object.", context);
  }

  assertFiniteNumbers(parsed, "definition", context);

  const version = parsed.version ?? 1;
  if (version !== 1) {
    fail("version must be 1 when provided.", context);
  }

  const type = optionalString(parsed.type, "type", context);
  if (!type?.trim()) fail("type is required.", context);

  if (!isRecord(parsed.figure)) {
    fail("figure.description is required.", context);
  }

  const title = optionalString(parsed.figure.title, "figure.title", context);
  const caption = optionalString(
    parsed.figure.caption,
    "figure.caption",
    context,
  );
  const description = optionalString(
    parsed.figure.description,
    "figure.description",
    context,
  );
  if (!description?.trim()) {
    fail("figure.description is required.", context);
  }

  if (parsed.size !== undefined && !isRecord(parsed.size)) {
    fail("size must be an object.", context);
  }

  const size = (parsed.size ?? {}) as Record<string, unknown>;
  const width = size.width ?? 760;
  const height = size.height ?? 420;
  if (typeof width !== "number" || width <= 0) {
    fail("size.width must be a positive number.", context);
  }
  if (typeof height !== "number" || height <= 0) {
    fail("size.height must be a positive number.", context);
  }

  const render = normalizeChartRenderMode(
    parsed.render as ChartRenderMode | "png-file" | undefined,
  );
  const media = optionalString(parsed.media, "media", context);
  const hydrate = normalizeChartHydration({
    hydrate: parsed.hydrate as ChartHydrationMode | "light" | undefined,
    media,
  });

  if (parsed.data !== undefined && !isRecord(parsed.data)) {
    fail("data must be an object when provided.", context);
  }
  if (parsed.option !== undefined && !isRecord(parsed.option)) {
    fail("option must be an object when provided.", context);
  }
  if (
    parsed.clientOption !== undefined &&
    parsed.clientOption !== "same" &&
    !isRecord(parsed.clientOption)
  ) {
    fail('clientOption must be an object or "same" when provided.', context);
  }
  if (parsed.overrides !== undefined && !isRecord(parsed.overrides)) {
    fail("overrides must be an object when provided.", context);
  }
  if (parsed.aria !== undefined && !isRecord(parsed.aria)) {
    fail("aria must be an object when provided.", context);
  }

  const optionClientPreset = optionalString(
    parsed.optionClientPreset,
    "optionClientPreset",
    context,
  );
  if (
    optionClientPreset !== undefined &&
    !CLIENT_PRESETS.has(optionClientPreset)
  ) {
    fail(
      `optionClientPreset must be one of ${Array.from(CLIENT_PRESETS).join(", ")}.`,
      context,
    );
  }

  const normalized: NormalizedEChartDefinition = {
    version: 1,
    type: type.trim(),
    id: optionalString(parsed.id, "id", context),
    className: optionalString(parsed.class, "class", context),
    figure: {
      ...(title ? { title } : {}),
      ...(caption ? { caption } : {}),
      description,
    },
    width,
    height,
    render,
    hydrate,
    ...(media ? { media } : {}),
    cacheKey: optionalString(parsed.cacheKey, "cacheKey", context),
    theme: parsed.theme as ChartTheme | undefined,
    aria: parsed.aria as Record<string, unknown> | undefined,
    optionClientPreset: optionClientPreset as ChartClientPreset | undefined,
    data: (parsed.data ?? {}) as Record<string, unknown>,
    option: parsed.option as ChartOption | undefined,
    clientOption: parsed.clientOption as ChartOption | "same" | undefined,
    overrides: parsed.overrides as ChartOption | undefined,
  };

  if (normalized.hydrate !== "none") {
    const hydrationOption =
      normalized.clientOption === "same"
        ? normalized.option
        : (normalized.clientOption ?? normalized.option);
    if (hydrationOption) {
      assertSerializableChartOption(hydrationOption);
    }
  }

  return normalized;
}
