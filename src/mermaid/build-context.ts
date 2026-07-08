/**
 * build-context.ts — the render-time bridge (SPEC FR-M5 / FR-CACHE4).
 *
 * `MermaidDiagram.astro` resolves a diagram that was prepared during the build.
 * That component may run in the SAME module instance as the build hook (dev /
 * same-process) or in a FRESH one (Astro's static-output prerender reloads
 * component chunks), so two resolution paths exist:
 *
 *   1. An in-memory registry set by the integration after preparation
 *      (`setPreparedMermaidDiagrams`) — fastest, used when the module is shared.
 *   2. The per-build manifest cache store — the only state that survives the
 *      module boundary. Defaults to the disk adapter bound to the manifest
 *      namespace + RENDERER_VERSION, matching what the pipeline wrote.
 *
 * If neither resolves the diagram (authored but never batched), resolution
 * throws an actionable error naming the stableId — never renders blank.
 */
import {
  createDiskCacheStore,
  MERMAID_MANIFEST_NAMESPACE,
  type DiagramCacheStore,
} from "../shared/cache.ts";
import { RENDERER_VERSION } from "./constants.ts";
import {
  getMermaidDiagramType,
  getMermaidStableId,
  normalizeMermaidDefinition,
} from "./definition.ts";
import type { RegisteredDiagram } from "./pipeline.ts";

export interface ResolvedMermaidDiagram {
  stableId: string;
  diagramType: string;
  diagram: RegisteredDiagram;
}

let inMemoryRegistry: Map<string, RegisteredDiagram> | null = null;

/**
 * Populate the same-process registry (called by the integration after
 * preparation). Optional — the disk manifest store is the durable fallback.
 */
export function setPreparedMermaidDiagrams(
  diagrams: Map<string, RegisteredDiagram>,
): void {
  inMemoryRegistry = diagrams;
}

export function clearPreparedMermaidDiagrams(): void {
  inMemoryRegistry = null;
}

const defaultManifestStore = (): DiagramCacheStore<RegisteredDiagram> =>
  createDiskCacheStore<RegisteredDiagram>(
    MERMAID_MANIFEST_NAMESPACE,
    RENDERER_VERSION,
  );

/**
 * Resolve a prepared diagram by its source. `store` defaults to the disk
 * manifest adapter; pass a caller-owned store to share a custom cache backend
 * with the build hook (FR-CACHE4). The `code`→`stableId` normalization here is
 * identical to discovery (FR-M1a), which is what makes the lookup hit.
 */
export function resolvePreparedMermaidDiagram(
  code: string,
  store?: DiagramCacheStore<RegisteredDiagram>,
): ResolvedMermaidDiagram {
  const normalizedCode = normalizeMermaidDefinition(code);
  if (!normalizedCode) {
    throw new Error("[mermaid] MermaidDiagram received an empty diagram.");
  }

  const stableId = getMermaidStableId(normalizedCode);
  const diagram =
    inMemoryRegistry?.get(stableId) ??
    (store ?? defaultManifestStore()).getSync(stableId);

  if (!diagram) {
    throw new Error(
      `[mermaid] Diagram "${stableId}" was not prepared before Astro component rendering. ` +
        "The diagram source was not discovered during build preparation. " +
        "Use defineMermaidDiagram() with a static string or String.raw template literal.",
    );
  }

  return {
    stableId,
    diagramType: getMermaidDiagramType(normalizedCode),
    diagram,
  };
}
