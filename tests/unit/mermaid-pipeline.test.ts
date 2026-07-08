import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Element } from "hast";
import {
  createPipeline,
  resolveRemoteCacheBaseUrl,
  type PipelineConfig,
  type RegisteredDiagram,
} from "../../src/mermaid/pipeline.ts";
import { fixtureRenderPipeline } from "../../src/mermaid/renderers.ts";
import {
  createDiskCacheStore,
  MERMAID_CACHE_NAMESPACE,
  MERMAID_MANIFEST_NAMESPACE,
} from "../../src/shared/cache.ts";
import { DARK_PALETTE, LIGHT_PALETTE } from "../../src/mermaid/palette.ts";
import { getMermaidStableId } from "../../src/mermaid/definition.ts";
import {
  RenderService,
  type MermaidPalette,
  type MermaidRenderPipeline,
} from "../../src/mermaid/types.ts";

const fixtureConfig: PipelineConfig = {
  render: fixtureRenderPipeline,
  fixture: true,
  batching: { chunkSize: 15, flushDebounceMs: 0, interChunkDelayMs: 0 },
  remoteCacheEnabled: false,
};

let baseDir: string;

beforeAll(async () => {
  baseDir = await mkdtemp(path.join(tmpdir(), "bmx-mermaid-"));
});

afterAll(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("DiagramPipeline (fixture mode via option)", () => {
  it("prepares diagrams for synchronous lookup, persists the manifest, and emits SVG pairs", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "bmx-mermaid-out-"));
    const svgBus = createDiskCacheStore<Element>(
      MERMAID_CACHE_NAMESPACE,
      "test",
      baseDir,
    );
    const manifestBus = createDiskCacheStore<RegisteredDiagram>(
      MERMAID_MANIFEST_NAMESPACE,
      "test",
      baseDir,
    );
    await svgBus.ensureDir();
    await manifestBus.clear();

    const themes = new Map<string, MermaidPalette>([
      ["light", LIGHT_PALETTE],
      ["dark", DARK_PALETTE],
    ]);
    const pipeline = createPipeline(
      svgBus,
      manifestBus,
      themes,
      "test",
      undefined,
      fixtureConfig,
    );

    const code = "graph TD\n  Registry --> Assets";
    const stableId = getMermaidStableId(code);

    await pipeline.prepareDiagrams(new Map([[stableId, code]]));

    const diagram = pipeline.getDiagram(stableId);
    expect(diagram?.stableId).toBe(stableId);
    expect(diagram?.node.tagName).toBe("svg");
    expect(diagram?.assetHref).toMatch(
      new RegExp(`/_app/mermaid/${stableId}-.*\\.svg$`),
    );
    expect(diagram?.assetHrefDark).toMatch(
      new RegExp(`/_app/mermaid/${stableId}-.*-dark\\.svg$`),
    );

    // The manifest store (read by the render bridge in a fresh module) has it.
    expect(manifestBus.getSync(stableId)?.stableId).toBe(stableId);

    await pipeline.emitAssets(pathToFileURL(`${outDir}/`));
    const emitted = await readdir(path.join(outDir, "_app", "mermaid"));
    expect(emitted).toContain(path.basename(diagram!.assetHref));
    expect(emitted).toContain(path.basename(diagram!.assetHrefDark));

    const darkSvg = await readFile(
      path.join(outDir, "_app", "mermaid", path.basename(diagram!.assetHrefDark)),
      "utf-8",
    );
    expect(darkSvg).toContain("data-mermaid-standalone-background");

    await rm(outDir, { recursive: true, force: true });
  });
});

describe("injected render pipeline (caller-owned port, SPEC §4.7)", () => {
  it("invokes the caller's pipeline with the batch + themes and uses its SVGs", async () => {
    const svgBus = createDiskCacheStore<Element>(
      MERMAID_CACHE_NAMESPACE,
      "test-injected",
      baseDir,
    );
    const manifestBus = createDiskCacheStore<RegisteredDiagram>(
      MERMAID_MANIFEST_NAMESPACE,
      "test-injected",
      baseDir,
    );
    await svgBus.ensureDir();
    await manifestBus.clear();

    const seenBatches: Array<Array<{ id: string; code: string }>> = [];
    const render: MermaidRenderPipeline = async (diagrams, themes) => {
      seenBatches.push(diagrams);
      const results: Record<string, Map<string, string>> = {};
      for (const d of diagrams) {
        const perTheme = new Map<string, string>();
        for (const name of themes.keys()) {
          const id = `mermaid-${d.id}-${name}`;
          perTheme.set(
            name,
            `<svg id="${id}" viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"><style>#${id} .node text{fill:#111}</style><g class="node"><text>${name}</text></g></svg>`,
          );
        }
        results[d.id] = perTheme;
      }
      return { results, service: RenderService.CloudflareWorker };
    };

    const themes = new Map<string, MermaidPalette>([
      ["light", LIGHT_PALETTE],
      ["dark", DARK_PALETTE],
    ]);
    const pipeline = createPipeline(
      svgBus,
      manifestBus,
      themes,
      "test-injected",
      undefined,
      {
        render,
        fixture: false,
        batching: { chunkSize: 15, flushDebounceMs: 0, interChunkDelayMs: 0 },
        remoteCacheEnabled: false,
      },
    );

    const code = "graph LR\n  A --> B";
    const stableId = getMermaidStableId(code);
    await pipeline.prepareDiagrams(new Map([[stableId, code]]));

    // The caller's pipeline was invoked with exactly our diagram.
    expect(seenBatches).toHaveLength(1);
    expect(seenBatches[0]!.map((d) => d.id)).toEqual([stableId]);

    // Its SVG output was accepted and, because fixture:false, cached to disk.
    const diagram = pipeline.getDiagram(stableId);
    expect(diagram?.node.tagName).toBe("svg");
    expect(await svgBus.get(diagram!.cacheKey)).not.toBeNull();
  });
});

describe("resolveRemoteCacheBaseUrl (option, not env)", () => {
  it("uses the deployed site cache when enabled", () => {
    expect(resolveRemoteCacheBaseUrl("https://example.com/", true)).toBe(
      "https://example.com",
    );
  });

  it("returns null when the remote cache is disabled", () => {
    expect(resolveRemoteCacheBaseUrl("https://example.com/", false)).toBeNull();
  });

  it("returns null when no site is configured", () => {
    expect(resolveRemoteCacheBaseUrl(undefined, true)).toBeNull();
  });
});
