import { describe, expect, it } from "vitest";
import { toHtml } from "hast-util-to-html";
import {
  buildMergedThemeNode,
  buildMergedThemeNodeInk,
  buildMergedThemeNodeWorker,
} from "../../src/mermaid/transform";
import { RenderService } from "../../src/mermaid/types";

function workerSvg(renderId: string, fill: string): string {
  return `<svg id="${renderId}" width="100%" viewBox="0 0 100 50" style="max-width: 100px;" xmlns="http://www.w3.org/2000/svg">
    <script>alert("bad")</script>
    <style>
      :root { --fixture-color: ${fill}; }
      #${renderId} .node rect { fill: ${fill}; }
      #${renderId} .edgePath path { stroke: ${fill}; }
      @keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
    </style>
    <defs><marker id="${renderId}-pointEnd"><path /></marker></defs>
    <g class="node" id="${renderId}-A"><rect class="basic" /></g>
    <path class="edgePath" marker-end="url(#${renderId}-pointEnd)" />
  </svg>`;
}

function inkSvg(fill: string, stroke: string): string {
  return `<svg id="mermaid-svg" width="100%" viewBox="0 0 100 50" style="max-width: 100px;" xmlns="http://www.w3.org/2000/svg">
    <style>@import url("https://example.test/fa.css");</style>
    <style>
      #mermaid-svg .node rect { rx: 4; }
      #mermaid-svg .edgePath path { stroke: ${stroke}; }
    </style>
    <g class="node" id="mermaid-svg-A">
      <rect class="basic" style="fill: ${fill}; stroke: ${stroke}; opacity: 0.8;" />
    </g>
  </svg>`;
}

describe("mermaid theme transforms", () => {
  it("merges Worker SVG themes into one sanitized scoped SVG", async () => {
    const node = await buildMergedThemeNodeWorker(
      new Map([
        ["light", workerSvg("worker-light", "#ffffff")],
        ["dark", workerSvg("worker-dark", "#111827")],
      ]),
      "sample",
    );

    const html = toHtml(node, { space: "svg" });
    expect(node.properties?.id).toBe("mermaid-sample");
    expect(node.properties?.width).toBe("100");
    expect(node.properties?.height).toBe("50");
    expect(html).not.toContain("<script");
    expect(html).toContain("#mermaid-sample .node rect");
    expect(html).toContain('[data-theme="dark"] #mermaid-sample');
    expect(html).toContain("@keyframes pulse");
    expect(html).toContain('marker-end="url(#mermaid-sample-pointEnd)"');
    expect(html).not.toContain("worker-light");
    expect(html).not.toContain("worker-dark");
  });

  it("hoists Ink inline colors into scoped CSS using final rewritten ids", async () => {
    const node = await buildMergedThemeNodeInk(
      new Map([
        ["light", inkSvg("#ffffff", "#2563eb")],
        ["dark", inkSvg("#111827", "#93c5fd")],
      ]),
      "ink-sample",
    );

    const html = toHtml(node, { space: "svg" });
    expect(node.properties?.id).toBe("mermaid-ink-sample");
    expect(html).toContain("#mermaid-ink-sample #mermaid-ink-sample-A rect.basic");
    expect(html).toContain(
      '[data-theme="dark"] #mermaid-ink-sample #mermaid-ink-sample-A rect.basic',
    );
    expect(html).toContain("fill: #ffffff !important");
    expect(html).toContain("stroke: #93c5fd !important");
    expect(html).toContain("opacity: 0.8");
    expect(html).not.toContain("fill: #ffffff; stroke: #2563eb");
    expect(html).not.toContain("mermaid-svg-A");
  });

  it("throws when placeholder services reach the transform dispatcher", async () => {
    await expect(
      buildMergedThemeNode(
        new Map([["light", workerSvg("worker-light", "#fff")]]),
        "bad",
        RenderService.FailurePlaceholder,
      ),
    ).rejects.toThrow("failure-placeholder");
  });
});
