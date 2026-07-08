import { describe, expect, it } from "vitest";
import { toHtml } from "hast-util-to-html";
import {
  collapseForeignObjectLineBreaks,
  flattenElements,
  parseSvgToHast,
  sanitizeStyleAttributes,
  stripScripts,
  updateHastIds,
} from "../../src/mermaid/hast";

describe("mermaid HAST utilities", () => {
  it("strips scripts, sanitizes style attributes, and collapses foreignObject breaks", () => {
    const root = parseSvgToHast(`
      <svg id="old">
        <script>alert("x")</script>
        <path id="old_path" style=" fill: red ; invalid ; stroke: blue !important; " />
        <foreignObject>
          <div xmlns="http://www.w3.org/1999/xhtml">
            <br></br><br></br><br></br><span>label</span>
          </div>
        </foreignObject>
      </svg>
    `);

    stripScripts(root);
    sanitizeStyleAttributes(root);
    collapseForeignObjectLineBreaks(root);

    const html = toHtml(root, { space: "svg" });
    expect(html).not.toContain("<script");
    expect(html).not.toContain("invalid");
    expect(html).toContain("stroke: blue !important");

    const breakCount = flattenElements(root).filter(
      (element) => element.tagName === "br",
    ).length;
    expect(breakCount).toBe(1);
  });

  it("updates root ids, derived ids, and SVG reference attributes", () => {
    const root = parseSvgToHast(`
      <svg id="old">
        <defs>
          <clipPath id="old-clip"><rect /></clipPath>
          <marker id="old_pointEnd"><path /></marker>
        </defs>
        <g id="old-node" clip-path="url(#old-clip)">
          <path marker-end="url(#old_pointEnd)" />
          <use href="#old-node" />
        </g>
      </svg>
    `);

    updateHastIds(root, "old", "new");

    const html = toHtml(root, { space: "svg" });
    expect(html).toContain('id="new"');
    expect(html).toContain('id="new-clip"');
    expect(html).toContain('id="new_pointEnd"');
    expect(html).toContain('id="new-node"');
    expect(html).toContain("url(#new-clip)");
    expect(html).toContain("url(#new_pointEnd)");
    expect(html).toContain('href="#new-node"');
    expect(html).not.toContain("#old");
  });
});
