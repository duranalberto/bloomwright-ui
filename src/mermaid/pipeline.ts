/**
 * pipeline.ts
 *
 * Build-time diagram pipeline: registry, batch orchestration, and cache.
 *
 * ## Public API (consumed by integration.ts and plugin.ts)
 *   createPipeline(svgBus, manifestBus, themes, logger) → DiagramPipeline
 *   DiagramPipeline.prepareDiagrams(diagrams) → Promise<void>
 *   DiagramPipeline.getDiagram(stableId) → RegisteredDiagram | null
 *   DiagramPipeline.logBuildSummary(astroLogger?)
 *
 * ## Design
 * All mutable state is encapsulated in DiagramPipeline. Callers receive an
 * instance from createPipeline() and pass it through the integration hooks
 * via closure — no module-level singletons, no manual reset calls.
 *
 * Batch orchestration is tuned for the CloudflareWorker service (batched
 * POST). When MermaidInk is the active service it serialises its own
 * requests internally; the debounce here still coalesces diagram preparation
 * so the Ink renderer receives all diagrams in a single render() call.
 *
 * The production asset cache (config.site + assetHref) is checked ahead of
 * the render service whenever `site` is configured, so an already-published,
 * known-good SVG is reused instead of re-rendering — this is what keeps a
 * Worker outage from taking every diagram down with it. Set
 * MERMAID_DISABLE_REMOTE_CACHE=true to force a fresh render every build.
 */

import type { AstroIntegrationLogger } from "astro";
import type { Element as HastElement } from "hast";
import { toHtml } from "hast-util-to-html";
import { createHash } from "node:crypto";
import fsAsync from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import type { DiagramCacheStore } from "../shared/cache.ts";
import { BuildLogger } from "./build-logger.ts";
import {
  createHastElement,
  parseSvgToHast,
  sanitizeStyleAttributes,
  stripScripts,
} from "./hast.ts";
import { isFallbackSvg } from "./renderers.ts";
import { buildMergedThemeNode } from "./transform.ts";
import {
  RenderService,
  type MermaidBatchingConfig,
  type MermaidPalette,
  type MermaidRenderPipeline,
} from "./types.ts";

/** Fully-resolved build-time config threaded from the integration factory. */
export interface PipelineConfig {
  /** Caller-owned external render pipeline (SPEC §4.7). */
  render: MermaidRenderPipeline;
  /**
   * True when `render` is the built-in fixture pipeline (no caller pipeline was
   * injected). Disables the durable/remote cache tiers so output stays
   * deterministic and hermetic.
   */
  fixture: boolean;
  batching: MermaidBatchingConfig;
  remoteCacheEnabled: boolean;
  debug?: boolean | undefined;
}

const STANDALONE_THEME_CSS_START = "/* mermaid-standalone-theme:start */";
const STANDALONE_THEME_CSS_END = "/* mermaid-standalone-theme:end */";
const STANDALONE_BACKGROUND_ATTR = "data-mermaid-standalone-background";

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface BatchItem {
  id: string;
  code: string;
  cacheKey: string;
}

export interface RegisteredDiagram {
  node: HastElement;
  stableId: string;
  cacheKey: string;
  assetHref: string;
  assetHrefDark: string;
}

interface DiagramAsset {
  stableId: string;
  cacheKey: string;
  assetHref: string;
  assetHrefDark: string;
  node: HastElement;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function buildCacheKey(code: string, version: string): string {
  return createHash("sha256").update(`${version}::${code}`).digest("hex");
}

export function buildAssetHref(stableId: string, cacheKey: string): string {
  return `/_app/mermaid/${stableId}-${cacheKey}.svg`;
}

export function buildDarkAssetHref(stableId: string, cacheKey: string): string {
  return `/_app/mermaid/${stableId}-${cacheKey}-dark.svg`;
}

/**
 * Builds a RegisteredDiagram from a raw cached HAST node. Pure and
 * process-independent — used both by DiagramPipeline (in-memory, during the
 * primary build) and by build-context.ts (reading straight from the disk
 * cache, since Astro's static-output prerender step reloads component chunks
 * in a fresh module instance that doesn't share the pipeline's in-memory
 * state).
 */
export function finalizeRegisteredDiagram(
  stableId: string,
  cacheKey: string,
  sourceNode: HastElement,
): RegisteredDiagram {
  const node = structuredClone(sourceNode);
  sanitizeStyleAttributes(node);

  const hasSvgAsset = node.tagName === "svg";

  return {
    node,
    stableId,
    cacheKey,
    assetHref: hasSvgAsset ? buildAssetHref(stableId, cacheKey) : "",
    assetHrefDark: hasSvgAsset ? buildDarkAssetHref(stableId, cacheKey) : "",
  };
}

function makeFallbackNode(): HastElement {
  return createHastElement("div", { className: ["mermaid-error"] }, [
    { type: "text", value: "Failed to render Mermaid diagram." },
  ]);
}

/** Returns true when every SVG in the map is a known failure/placeholder. */
function isRenderFailure(svgMap: Map<string, string>): boolean {
  for (const svg of svgMap.values()) {
    if (!isFallbackSvg(svg)) return false;
  }
  return true;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function findSvg(root: ReturnType<typeof parseSvgToHast>): HastElement | null {
  for (const child of root.children) {
    if (child.type === "element" && child.tagName === "svg") return child;
  }
  return null;
}

function stripStandaloneCss(svgEl: HastElement): void {
  svgEl.children = svgEl.children.filter((child) => {
    if (child.type !== "element") return true;
    const props = child.properties ?? {};
    return (
      props[STANDALONE_BACKGROUND_ATTR] !== "true" &&
      props.dataMermaidStandaloneBackground !== "true"
    );
  });

  for (const child of svgEl.children) {
    if (child.type !== "element" || child.tagName !== "style") continue;
    const first = child.children[0];
    if (!first || first.type !== "text") continue;
    first.value = first.value.replace(
      /\/\* mermaid-standalone-theme:start \*\/[\s\S]*?\/\* mermaid-standalone-theme:end \*\//g,
      "",
    );
  }
}

function appendStandaloneBackgroundCss(
  svgEl: HastElement,
  backgroundColor: string,
  colorScheme: "light" | "dark",
): void {
  const css = [
    STANDALONE_THEME_CSS_START,
    `svg { background-color: ${backgroundColor}; color-scheme: ${colorScheme}; }`,
    STANDALONE_THEME_CSS_END,
  ].join("\n");

  for (const child of svgEl.children) {
    if (child.type !== "element" || child.tagName !== "style") continue;
    const first = child.children[0];
    if (first?.type === "text") {
      first.value = `${first.value}\n${css}`;
      return;
    }
  }

  svgEl.children.unshift({
    type: "element",
    tagName: "style",
    properties: {},
    children: [{ type: "text", value: css }],
  });
}

function prependStandaloneBackgroundRect(
  svgEl: HastElement,
  backgroundColor: string,
): void {
  svgEl.children.unshift({
    type: "element",
    tagName: "rect",
    properties: {
      [STANDALONE_BACKGROUND_ATTR]: "true",
      width: "100%",
      height: "100%",
      fill: backgroundColor,
    },
    children: [],
  });
}

function getSvgRootId(svgEl: HastElement): string | null {
  const id = svgEl.properties?.id;
  return typeof id === "string" ? id : null;
}

function getStyleText(svgEl: HastElement): string {
  for (const child of svgEl.children) {
    if (child.type !== "element" || child.tagName !== "style") continue;
    const first = child.children[0];
    if (first?.type === "text") return first.value;
  }
  return "";
}

function appendDarkThemeCss(svgEl: HastElement): void {
  const rootId = getSvgRootId(svgEl);
  if (!rootId) return;

  const css = getStyleText(svgEl);
  if (!css.includes(`[data-theme="dark"] #${rootId}`)) return;

  const darkCss = css.replaceAll(
    `[data-theme="dark"] #${rootId}`,
    `#${rootId}`,
  );
  for (const child of svgEl.children) {
    if (child.type !== "element" || child.tagName !== "style") continue;
    const first = child.children[0];
    if (first?.type === "text") {
      first.value = `${first.value}\n${darkCss}`;
      return;
    }
  }
}

function serializeSvgAsset(
  node: HastElement,
  variant: "light" | "dark",
  backgroundColor: string,
): string {
  const svg = structuredClone(node);
  if (variant === "dark") appendDarkThemeCss(svg);
  appendStandaloneBackgroundCss(svg, backgroundColor, variant);
  prependStandaloneBackgroundRect(svg, backgroundColor);
  return toHtml(svg, { space: "svg" });
}

// ─────────────────────────────────────────────────────────────────────────────
// DiagramPipeline
// ─────────────────────────────────────────────────────────────────────────────

export class DiagramPipeline {
  private readonly svgBus: DiagramCacheStore<HastElement>;
  private readonly manifestBus: DiagramCacheStore<RegisteredDiagram>;
  private readonly themes: Map<string, MermaidPalette>;
  private readonly rendererVersion: string;
  private readonly config: PipelineConfig;
  private readonly fixtureMode: boolean;
  private readonly buildLogger: BuildLogger;
  private readonly remoteCacheBaseUrl: string | null;

  private currentBatch: BatchItem[] = [];
  private batchPromise: Promise<Record<string, HastElement>> | null = null;
  private readonly memoryCache = new Map<string, HastElement>();
  private readonly usedAssets = new Map<string, DiagramAsset>();
  private readonly preparedDiagrams = new Map<string, RegisteredDiagram>();

  constructor(
    svgBus: DiagramCacheStore<HastElement>,
    manifestBus: DiagramCacheStore<RegisteredDiagram>,
    themes: Map<string, MermaidPalette>,
    rendererVersion: string,
    site: string | undefined,
    config: PipelineConfig,
  ) {
    this.svgBus = svgBus;
    this.manifestBus = manifestBus;
    this.themes = themes;
    this.rendererVersion = rendererVersion;
    this.config = config;
    this.fixtureMode = config.fixture;
    this.buildLogger = new BuildLogger({
      fixture: config.fixture,
      debug: config.debug,
    });
    this.remoteCacheBaseUrl = resolveRemoteCacheBaseUrl(
      site,
      config.remoteCacheEnabled,
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────

  async prepareDiagrams(diagrams: Map<string, string>): Promise<void> {
    this.preparedDiagrams.clear();

    await Promise.all(
      Array.from(diagrams.entries()).map(async ([stableId, code]) => {
        const diagram = await this.resolveDiagram(stableId, code);
        this.preparedDiagrams.set(stableId, diagram);
        // Persisted even for failure placeholders — the static-output
        // prerender step reads this manifest from a fresh module instance
        // that never sees this.preparedDiagrams (see build-context.ts).
        await this.manifestBus.set(stableId, diagram);
      }),
    );
  }

  getDiagram(stableId: string): RegisteredDiagram | null {
    return this.preparedDiagrams.get(stableId) ?? null;
  }

  /** Snapshot of every prepared diagram — seeds the render-bridge registry. */
  getPreparedDiagrams(): Map<string, RegisteredDiagram> {
    return new Map(this.preparedDiagrams);
  }

  /**
   * Resolve a diagram for rendering. Returns the generated asset metadata.
   *
   * Cache hierarchy: memory → disk → production asset → batch network render.
   */
  private async resolveDiagram(
    stableId: string,
    code: string,
  ): Promise<RegisteredDiagram> {
    const fixtureMode = this.fixtureMode;
    const cacheKey = buildCacheKey(code, this.rendererVersion);
    const assetHref = buildAssetHref(stableId, cacheKey);
    const assetHrefDark = buildDarkAssetHref(stableId, cacheKey);

    // 1. Memory cache hit
    const fromMemory = this.memoryCache.get(cacheKey);
    if (fromMemory) {
      return this.registerResolvedNode(
        stableId,
        cacheKey,
        assetHref,
        assetHrefDark,
        fromMemory,
      );
    }

    // 2. Disk cache hit
    if (!fixtureMode) {
      const fromDisk = await this.svgBus.get(cacheKey);
      if (fromDisk) {
        this.memoryCache.set(cacheKey, fromDisk);
        return this.registerResolvedNode(
          stableId,
          cacheKey,
          assetHref,
          assetHrefDark,
          fromDisk,
        );
      }
    }

    // 3. Production asset cache hit
    if (!fixtureMode) {
      const fromRemote = await this.getRemoteCachedNode(assetHref);
      if (fromRemote) {
        await this.svgBus.set(cacheKey, fromRemote);
        this.memoryCache.set(cacheKey, fromRemote);
        return this.registerResolvedNode(
          stableId,
          cacheKey,
          assetHref,
          assetHrefDark,
          fromRemote,
        );
      }
    }

    // 4. Queue for batch rendering (deduplicated by stableId)
    if (!this.currentBatch.some((item) => item.id === stableId)) {
      this.currentBatch.push({ id: stableId, code, cacheKey });
    }

    // 5. Arm the debounced batch flush
    if (!this.batchPromise) {
      this.batchPromise = new Promise((resolve) => {
        setTimeout(async () => {
          const results = await this.runBatchFlush();
          resolve(results);
        }, this.config.batching.flushDebounceMs);
      });
    }

    const resultsMap = await this.batchPromise;
    return this.registerResolvedNode(
      stableId,
      cacheKey,
      assetHref,
      assetHrefDark,
      resultsMap[stableId] ?? makeFallbackNode(),
    );
  }

  logBuildSummary(logger?: AstroIntegrationLogger): void {
    this.buildLogger.logBuildSummary(logger);
  }

  async emitAssets(
    outDir: URL,
    logger?: AstroIntegrationLogger,
  ): Promise<void> {
    if (this.usedAssets.size === 0) return;

    const root = path.join(fileURLToPath(outDir), "_app", "mermaid");
    await fsAsync.mkdir(root, { recursive: true });

    await Promise.all(
      Array.from(this.usedAssets.values()).map(async (asset) => {
        const fileName = path.basename(asset.assetHref);
        const darkFileName = path.basename(asset.assetHrefDark);
        await Promise.all([
          fsAsync.writeFile(
            path.join(root, fileName),
            serializeSvgAsset(
              asset.node,
              "light",
              this.themes.get("light")?.base100 ?? "#ffffff",
            ),
            "utf-8",
          ),
          fsAsync.writeFile(
            path.join(root, darkFileName),
            serializeSvgAsset(
              asset.node,
              "dark",
              this.themes.get("dark")?.base100 ?? "#21212a",
            ),
            "utf-8",
          ),
        ]);
      }),
    );

    logger?.info(
      `Emitted ${this.usedAssets.size} Mermaid SVG asset pair(s).`,
    );
  }

  // ── Private: batch orchestration ────────────────────────────────────────

  private registerResolvedNode(
    stableId: string,
    cacheKey: string,
    assetHref: string,
    assetHrefDark: string,
    sourceNode: HastElement,
  ): RegisteredDiagram {
    const diagram = finalizeRegisteredDiagram(stableId, cacheKey, sourceNode);

    if (diagram.assetHref) {
      this.usedAssets.set(cacheKey, {
        stableId,
        cacheKey,
        assetHref,
        assetHrefDark,
        node: structuredClone(diagram.node),
      });
    }

    return diagram;
  }

  private async getRemoteCachedNode(
    assetHref: string,
  ): Promise<HastElement | null> {
    if (!this.remoteCacheBaseUrl) return null;

    try {
      const response = await fetch(`${this.remoteCacheBaseUrl}${assetHref}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return null;

      const root = parseSvgToHast(await response.text());
      stripScripts(root);
      const svgEl = findSvg(root);
      if (!svgEl) return null;

      stripStandaloneCss(svgEl);
      sanitizeStyleAttributes(svgEl);
      return svgEl;
    } catch {
      return null;
    }
  }

  private async runBatchFlush(): Promise<Record<string, HastElement>> {
    const items = [...this.currentBatch];
    this.currentBatch = [];
    this.batchPromise = null;

    if (items.length === 0) return {};

    this.buildLogger.logBatchFlush(items.length);

    const finalResults: Record<string, HastElement> = {};
    const { chunkSize, interChunkDelayMs } = this.config.batching;
    const chunks = chunkArray(items, chunkSize);

    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        this.buildLogger.logRateLimitPause(interChunkDelayMs / 1000);
        await sleep(interChunkDelayMs);
      }
      const chunkResults = await this.renderChunk(chunks[i]!);
      Object.assign(finalResults, chunkResults);
    }

    return finalResults;
  }

  private async renderChunk(
    items: BatchItem[],
  ): Promise<Record<string, HastElement>> {
    const t0 = performance.now();
    const results: Record<string, HastElement> = {};

    const fetchResp = await this.config
      .render(
        items.map((d) => ({ id: d.id, code: d.code })),
        this.themes,
      )
      .catch((err) => {
        console.error(
          "[mermaid:pipeline] the injected render pipeline threw unexpectedly:",
          err,
        );
        return {
          results: {} as Record<string, Map<string, string>>,
          service: RenderService.FailurePlaceholder,
        };
      });

    const { results: batchResults, service } = fetchResp;

    for (const item of items) {
      const itemT0 = performance.now();
      const svgMap = batchResults[item.id];
      let node: HastElement;

      if (
        svgMap &&
        svgMap.size > 0 &&
        service !== RenderService.FailurePlaceholder &&
        !isRenderFailure(svgMap)
      ) {
        try {
          node = await buildMergedThemeNode(svgMap, item.id, service);
          if (!this.fixtureMode) {
            await this.svgBus.set(item.cacheKey, node);
          }
          this.memoryCache.set(item.cacheKey, node);

          this.buildLogger.logDiagramResult({
            stableId: item.id,
            service,
            duration: Math.round(performance.now() - itemT0),
            themes: Array.from(this.themes.keys()),
          });
        } catch (err) {
          this.buildLogger.logDiagramError(item.id, err);
          node = makeFallbackNode();
          // Do not cache — transform failure may be transient.
        }
      } else {
        node = makeFallbackNode();
        if (service !== RenderService.FailurePlaceholder) {
          this.buildLogger.logDiagramError(
            item.id,
            new Error(`Render produced no usable SVG for "${item.id}"`),
          );
        }
        // Do not cache placeholder/failure nodes.
      }

      results[item.id] = node;
    }

    this.buildLogger.logChunkDone(performance.now() - t0, service);
    return results;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates and returns a new DiagramPipeline instance.
 * Call once per build in the astro:build:start hook.
 */
export function createPipeline(
  svgBus: DiagramCacheStore<HastElement>,
  manifestBus: DiagramCacheStore<RegisteredDiagram>,
  themes: Map<string, MermaidPalette>,
  rendererVersion: string,
  site: string | undefined,
  config: PipelineConfig,
): DiagramPipeline {
  return new DiagramPipeline(
    svgBus,
    manifestBus,
    themes,
    rendererVersion,
    site,
    config,
  );
}

export function resolveRemoteCacheBaseUrl(
  site: string | undefined,
  remoteCacheEnabled: boolean,
): string | null {
  return !remoteCacheEnabled || !site ? null : site.replace(/\/$/, "");
}
