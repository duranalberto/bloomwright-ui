import { describe, expect, it } from "vitest";
import { collectMermaidDiagrams } from "../../src/mermaid/collect.ts";
import { getMermaidStableId } from "../../src/mermaid/definition.ts";
import type { SourceDocument } from "../../src/shared/content-selection.ts";

function mermaidFence(code: string): string {
  return `\`\`\`mermaid\n${code}\n\`\`\``;
}

const astroWithDefines = (shared: string): SourceDocument => ({
  filePath: "src/pages/example.astro",
  content: [
    "---",
    'import { defineMermaidDiagram } from "bloomwright-ui/mermaid";',
    "const shared = defineMermaidDiagram(String.raw`",
    shared,
    "`);",
    "const only = defineMermaidDiagram(`sequenceDiagram\\n  A->>B: hello`);",
    "---",
    "<MermaidDiagram code={shared} />",
    "<MermaidDiagram code={only} />",
  ].join("\n"),
});

describe("collectMermaidDiagrams (discovery + static contract)", () => {
  it("collects fences and static defineMermaidDiagram() calls, deduped by stableId", () => {
    const sharedCode = "graph TD\n  Source --> Output";
    const componentOnly = "sequenceDiagram\n  A->>B: hello";

    const diagrams = collectMermaidDiagrams([
      { filePath: "src/post.mdx", content: mermaidFence(sharedCode) },
      astroWithDefines(sharedCode),
    ]);

    // shared appears as both a fence and a define → one entry (FR-M1a).
    expect(diagrams.size).toBe(2);
    expect(diagrams.get(getMermaidStableId(sharedCode))).toBe(sharedCode);
    expect(diagrams.get(getMermaidStableId(componentOnly))).toBe(componentOnly);
  });

  it("normalizes identically for fence and define (same stableId)", () => {
    const viaFence = collectMermaidDiagrams([
      { filePath: "a.mdx", content: mermaidFence("graph TD; A-->B") },
    ]);
    const viaDefine = collectMermaidDiagrams([
      {
        filePath: "b.astro",
        content:
          "---\nconst d = defineMermaidDiagram(`graph TD; A-->B`);\n---",
      },
    ]);
    expect([...viaFence.keys()]).toEqual([...viaDefine.keys()]);
  });

  it("rejects a dynamic (interpolated) defineMermaidDiagram() call (FR-M1)", () => {
    expect(() =>
      collectMermaidDiagrams([
        {
          filePath: "src/pages/dynamic.astro",
          content: [
            "---",
            "const node = 'Output';",
            "const d = defineMermaidDiagram(`graph TD\\n  A --> ${node}`);",
            "---",
          ].join("\n"),
        },
      ]),
    ).toThrow(/must use a static string or String\.raw template literal/);
  });

  it("only sees the documents it is given (the selectSources seam)", () => {
    const kept = "graph TD\n  Kept --> Build";
    const dropped = "graph TD\n  Dropped --> Build";
    const docs: SourceDocument[] = [
      { filePath: "src/kept.mdx", content: mermaidFence(kept) },
      { filePath: "src/dropped.mdx", content: mermaidFence(dropped) },
    ];

    // Simulate selectSources filtering out the dropped file.
    const selected = docs.filter((d) => !d.filePath.includes("dropped"));
    const diagrams = collectMermaidDiagrams(selected);

    expect(diagrams.has(getMermaidStableId(kept))).toBe(true);
    expect(diagrams.has(getMermaidStableId(dropped))).toBe(false);
  });
});
