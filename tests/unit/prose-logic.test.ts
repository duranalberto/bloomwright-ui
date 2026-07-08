import { describe, expect, it } from "vitest";
import {
  CODE_BLOCK_WRAPPER_CLASS,
  wrapCodeBlockHtml,
} from "../../src/logic/code-block.ts";
import {
  resolveHeadingTag,
  HEADING_ANCHOR_TAGGED_LEVELS,
} from "../../src/logic/heading-anchor.ts";

describe("code-block shared logic (parity source)", () => {
  it("wraps highlighted code in the mockup-code shell with the shared class", () => {
    const html = wrapCodeBlockHtml("<code>const x = 1;</code>");
    expect(html).toContain('<div class="not-prose">');
    expect(html).toContain(`<div class="${CODE_BLOCK_WRAPPER_CLASS}">`);
    expect(html).toContain('<div class="overflow-x-auto">');
    expect(html).toContain("<code>const x = 1;</code>");
    // Structure closes cleanly (three wrappers).
    expect(html.endsWith("</div></div></div>")).toBe(true);
  });

  it("pins the mockup-code class so component + plugin can't drift", () => {
    expect(CODE_BLOCK_WRAPPER_CLASS).toContain("mockup-code");
    expect(CODE_BLOCK_WRAPPER_CLASS).toContain("bg-base-200");
  });
});

describe("heading-anchor shared logic (parity source)", () => {
  it("defaults the rendered tag to h2 and honors an explicit `as`", () => {
    expect(resolveHeadingTag()).toBe("h2");
    expect(resolveHeadingTag(undefined)).toBe("h2");
    expect(resolveHeadingTag("")).toBe("h2");
    expect(resolveHeadingTag("h3")).toBe("h3");
  });

  it("tags deeper levels (h2 is the implicit component default)", () => {
    expect(HEADING_ANCHOR_TAGGED_LEVELS).toContain("h3");
    expect(HEADING_ANCHOR_TAGGED_LEVELS).not.toContain("h2");
  });
});
