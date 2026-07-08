/**
 * renderer-integration.ts — the `mermaidRenderer()` Astro integration.
 *
 * bloomwright-ui owns Mermaid SVG *creation* end to end. This integration:
 *   1. pre-scans source files for ` ```mermaid ` fences + static
 *      `defineMermaidDiagram()` calls (build:start),
 *   2. batch-renders them through the caller-owned pipeline (`render`), caches
 *      the SVGs, and seeds the render bridge,
 *   3. emits the `_app/mermaid/*.svg` assets (build:generated).
 *
 * The components (`<MermaidDiagram>`) resolve prepared diagrams from the bridge
 * at render time — whether they were emitted by bloomwright-mdx's fence plugin
 * or hand-written in a page. bloomwright-mdx never touches this path: it only
 * emits `<MermaidDiagram code>` and is unaware of who renders the SVG.
 *
 * Register it alongside `bloomwrightMdx()`; order relative to `mdx()` does not
 * matter (it augments no Markdown processor — it only runs build hooks).
 */
import type { AstroIntegration, AstroIntegrationLogger } from "astro";
import glob from "fast-glob";
import type { Element as HastElement } from "hast";
import fsAsync from "node:fs/promises";
import {
  createDiskCacheStore,
  MERMAID_CACHE_NAMESPACE,
  MERMAID_MANIFEST_NAMESPACE,
  type CacheStoreFactory,
} from "../shared/cache.ts";
import {
  identitySelection,
  type ContentSelection,
  type SourceDocument,
  type SourceScanOptions,
} from "../shared/content-selection.ts";
import { collectMermaidDiagrams } from "./collect.ts";
import {
  CHUNK_SIZE,
  FLUSH_DEBOUNCE_MS,
  INTER_CHUNK_DELAY_MS,
  RENDERER_VERSION,
} from "./constants.ts";
import {
  clearPreparedMermaidDiagrams,
  setPreparedMermaidDiagrams,
} from "./build-context.ts";
import {
  createPipeline,
  type DiagramPipeline,
  type RegisteredDiagram,
} from "./pipeline.ts";
import { fixtureRenderPipeline } from "./renderers.ts";
import type { MermaidPalette, MermaidRenderPipeline } from "./types.ts";

/** Batching/rate-limit tuning (all optional; defaults from constants.ts). */
export interface MermaidBatchingOptions {
  chunkSize?: number;
  flushDebounceMs?: number;
  interChunkDelayMs?: number;
}

export interface MermaidRendererOptions extends ContentSelection {
  /**
   * Caller-owned external render pipeline (SPEC §4.7). Turns diagram text into
   * themed SVGs — e.g. a Cloudflare Worker / mermaid.ink client. Omit it and the
   * build emits deterministic fixtures with no network, after a warning —
   * suitable for dev/tests only.
   */
  render?: MermaidRenderPipeline;
  /** Branded palettes keyed by `[data-theme]` name (e.g. "light", "dark"). */
  themes?: Map<string, MermaidPalette>;
  /** Worker batching/rate-limit tuning. */
  batching?: MermaidBatchingOptions;
  /** Glob roots for the build pre-scan. */
  sources?: SourceScanOptions;
  /** Caller-owned cache backend (SPEC §4.7). Omit → built-in disk adapter. */
  cache?: CacheStoreFactory;
  /** Extra salt mixed into the cache version on top of RENDERER_VERSION. */
  cacheVersion?: string;
  /** Reuse already-published SVGs from `config.site`. @default true */
  remoteCache?: boolean;
  /** Verbose build logging. */
  debug?: boolean;
}

const DEFAULT_MERMAID_SOURCES = ["src/**/*.{md,mdx,astro,ts,tsx}"];
const DEFAULT_MERMAID_IGNORE = ["src/**/*.d.ts"];

function normalizeSourcePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

async function readSourceDocuments(
  include: string[],
  ignore: string[],
): Promise<SourceDocument[]> {
  const files = await glob(include, ignore.length ? { ignore } : {});
  const documents: SourceDocument[] = [];

  await Promise.all(
    files.map(async (filePath) => {
      try {
        documents.push({
          filePath: normalizeSourcePath(filePath),
          content: await fsAsync.readFile(filePath, "utf-8"),
        });
      } catch {
        // File disappeared between glob and read; ignore this preparation miss.
      }
    }),
  );

  return documents;
}

export function mermaidRenderer(
  options: MermaidRendererOptions = {},
): AstroIntegration {
  const select = options.selectSources ?? identitySelection;
  const themes: Map<string, MermaidPalette> = options.themes ?? new Map();
  const cacheFactory: CacheStoreFactory = options.cache ?? createDiskCacheStore;
  const cacheVersion = options.cacheVersion
    ? `${RENDERER_VERSION}-${options.cacheVersion}`
    : RENDERER_VERSION;
  const injectedRender = options.render;
  const render: MermaidRenderPipeline = injectedRender ?? fixtureRenderPipeline;
  const usingFixtures = injectedRender === undefined;
  const batching = {
    chunkSize: options.batching?.chunkSize ?? CHUNK_SIZE,
    flushDebounceMs: options.batching?.flushDebounceMs ?? FLUSH_DEBOUNCE_MS,
    interChunkDelayMs:
      options.batching?.interChunkDelayMs ?? INTER_CHUNK_DELAY_MS,
  };
  const include = options.sources?.include ?? DEFAULT_MERMAID_SOURCES;
  const ignore = options.sources?.ignore ?? DEFAULT_MERMAID_IGNORE;

  let pipeline: DiagramPipeline | null = null;
  let site: string | undefined;

  async function prepareMermaidDiagrams(
    activePipeline: DiagramPipeline,
    logger: AstroIntegrationLogger,
  ): Promise<void> {
    const documents = select(await readSourceDocuments(include, ignore));
    const seen = collectMermaidDiagrams(documents);
    if (seen.size === 0) return;

    if (usingFixtures) {
      logger.warn(
        "No render pipeline provided (mermaidRenderer.render) — emitting " +
          `${seen.size} development fixture(s) with no network. Pass a ` +
          "MermaidRenderPipeline for production SVGs (see examples/reference/).",
      );
    }

    logger.info(`Preparing ${seen.size} mermaid diagram(s) before Vite build…`);
    await activePipeline.prepareDiagrams(seen);
    // Seed the same-process render bridge (fresh-module prerender reads disk).
    setPreparedMermaidDiagrams(activePipeline.getPreparedDiagrams());
    logger.info("Mermaid diagram preparation complete.");
  }

  return {
    name: "bloomwright-mermaid-renderer",
    hooks: {
      "astro:config:done": ({ config }) => {
        site = config.site?.toString();
      },

      "astro:build:start": async ({ logger }) => {
        const svgBus = cacheFactory<HastElement>(
          MERMAID_CACHE_NAMESPACE,
          cacheVersion,
        );
        const manifestBus = cacheFactory<RegisteredDiagram>(
          MERMAID_MANIFEST_NAMESPACE,
          cacheVersion,
        );

        await svgBus.ensureDir();
        // Per-build scratch — wiped so stale entries never leak into this build.
        await manifestBus.clear();

        pipeline = createPipeline(
          svgBus,
          manifestBus,
          themes,
          RENDERER_VERSION,
          site,
          {
            render,
            fixture: usingFixtures,
            batching,
            remoteCacheEnabled: options.remoteCache ?? true,
            debug: options.debug,
          },
        );

        await prepareMermaidDiagrams(pipeline, logger);
      },

      "astro:build:generated": async ({ dir, logger }) => {
        await pipeline?.emitAssets(dir, logger);
      },

      "astro:build:done": ({ logger }) => {
        pipeline?.logBuildSummary(logger);
        pipeline = null;
        clearPreparedMermaidDiagrams();
      },
    },
  };
}
