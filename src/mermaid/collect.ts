/**
 * collect.ts — Mermaid diagram discovery (the "get the setup from MDX" step).
 *
 * Scans document text for ` ```mermaid ` fences and statically analyzable
 * `defineMermaidDiagram()` calls, then dedupes them by stableId. This is pure
 * extraction: the discovered `Map<stableId, code>` is handed to the render core
 * in the pipeline (`DiagramPipeline.prepareDiagrams`) — this layer never
 * renders. Discovery and render share the identical normalize → stableId
 * addressing (`./definition.ts`) so lookups always hit (FR-M1a).
 */
import {
  getMermaidStableId,
  normalizeMermaidDefinition,
} from "./definition.ts";
import type { SourceDocument } from "../shared/content-selection.ts";
import { extractMermaidDefinitionCalls } from "./source-parser.ts";

export function extractMermaidBlocks(content: string): string[] {
  const blocks: string[] = [];
  const regex = /^```mermaid[^\n]*\n([\s\S]*?)^```\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const code = match[1]!.trim();
    if (code) blocks.push(code);
  }

  return blocks;
}

/**
 * Merge every unique diagram authored across the given documents, keyed by
 * stableId. Discovers ` ```mermaid ` fences (any text) and statically
 * analyzable `defineMermaidDiagram()` calls (`.astro`/`.ts`/`.tsx`, via the AST
 * source-parser). A dynamic definition throws (FR-M1).
 */
export function collectMermaidDiagrams(
  documents: SourceDocument[],
): Map<string, string> {
  const seen = new Map<string, string>();

  for (const document of documents) {
    const sourceCodes = [
      ...extractMermaidBlocks(document.content),
      ...extractMermaidDefinitionCalls(document.content, document.filePath),
    ];

    for (const sourceCode of sourceCodes) {
      const code = normalizeMermaidDefinition(sourceCode);
      if (!code) continue;

      const stableId = getMermaidStableId(code);
      if (!seen.has(stableId)) seen.set(stableId, code);
    }
  }

  return seen;
}
