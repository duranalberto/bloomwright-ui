import { describe, expect, it, afterEach } from "vitest";
import type { Element } from "hast";
import {
  clearPreparedMermaidDiagrams,
  resolvePreparedMermaidDiagram,
  setPreparedMermaidDiagrams,
} from "../../src/mermaid/build-context";
import { getMermaidStableId } from "../../src/mermaid/definition";
import type { RegisteredDiagram } from "../../src/mermaid/pipeline";

function fixtureSvgNode(): Element {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      id: "fixture-diagram",
      viewBox: "0 0 10 10",
    },
    children: [],
  };
}

function fixtureDiagram(stableId: string): RegisteredDiagram {
  return {
    node: fixtureSvgNode(),
    stableId,
    cacheKey: `cache-${stableId}`,
    assetHref: `/_app/mermaid/${stableId}.svg`,
    assetHrefDark: `/_app/mermaid/${stableId}-dark.svg`,
  };
}

describe("Mermaid component build registry", () => {
  afterEach(() => {
    clearPreparedMermaidDiagrams();
  });

  it("resolves prepared component diagrams by source", () => {
    const code = "sequenceDiagram\n  A->>B: hello";
    const stableId = getMermaidStableId(code);

    setPreparedMermaidDiagrams(new Map([[stableId, fixtureDiagram(stableId)]]));

    expect(resolvePreparedMermaidDiagram(code)).toMatchObject({
      stableId,
      diagramType: "sequence",
      diagram: {
        assetHref: `/_app/mermaid/${stableId}.svg`,
        assetHrefDark: `/_app/mermaid/${stableId}-dark.svg`,
      },
    });
  });

  it("fails clearly when a component diagram was not prepared", () => {
    expect(() =>
      resolvePreparedMermaidDiagram("graph TD\n  Missing --> Registry"),
    ).toThrow(/was not prepared before Astro component rendering/);
  });
});
