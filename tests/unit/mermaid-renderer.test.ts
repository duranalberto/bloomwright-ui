import { afterEach, describe, expect, it } from "vitest";
import type { Element } from "hast";
import { mermaidRenderer } from "../../src/mermaid/renderer-integration.ts";
import {
  clearPreparedMermaidDiagrams,
  getMermaidStableId,
  renderMermaidFenceHtml,
  setPreparedMermaidDiagrams,
  type RegisteredDiagram,
} from "../../src/mermaid/index.ts";

afterEach(() => clearPreparedMermaidDiagrams());

function fixtureDiagram(stableId: string): RegisteredDiagram {
  const node: Element = {
    type: "element",
    tagName: "svg",
    properties: { id: "x", viewBox: "0 0 10 10" },
    children: [],
  };
  return {
    node,
    stableId,
    cacheKey: `c-${stableId}`,
    assetHref: `/_app/mermaid/${stableId}.svg`,
    assetHrefDark: `/_app/mermaid/${stableId}-dark.svg`,
  };
}

describe("mermaidRenderer integration (bloomwright-ui owns SVG creation)", () => {
  it("is a named Astro integration owning the mermaid build hooks", () => {
    const integration = mermaidRenderer();
    expect(integration.name).toBe("bloomwright-mermaid-renderer");
    expect(integration.hooks["astro:build:start"]).toBeTypeOf("function");
    expect(integration.hooks["astro:build:generated"]).toBeTypeOf("function");
    expect(integration.hooks["astro:build:done"]).toBeTypeOf("function");
    // It renders/emits; it must NOT augment the Markdown processor (mdx does).
    expect(integration.hooks["astro:config:setup"]).toBeUndefined();
  });
});

describe("renderMermaidFenceHtml (the .md path bloomwright-mdx calls)", () => {
  const code = "graph TD\n  A --> B";

  it("serializes a prepared diagram to container HTML with inline SVG", () => {
    const id = getMermaidStableId(code);
    setPreparedMermaidDiagrams(new Map([[id, fixtureDiagram(id)]]));

    const html = renderMermaidFenceHtml(code);
    expect(html).toContain('class="mermaid-diagram-container"');
    expect(html).toContain('class="mermaid-diagram-image"');
    expect(html).toContain("<svg");
    expect(html).toContain("/_app/mermaid/");
  });

  it("throws loudly when the diagram was never prepared", () => {
    expect(() => renderMermaidFenceHtml("graph ZZ\n  X --> Y")).toThrow(
      /was not prepared/,
    );
  });
});
