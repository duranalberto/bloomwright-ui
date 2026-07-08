import { describe, expect, it } from "vitest";
import { resolveSectionHeader } from "../../src/logic/section-header.ts";

describe("SectionHeader resolver", () => {
  it("defaults to an <h2> and trims the title", () => {
    expect(resolveSectionHeader({ title: "  Publications  " })).toMatchObject({
      title: "Publications",
      level: 2,
      headingTag: "h2",
    });
  });

  it("emits an <h3> when level 3 is requested and preserves the id", () => {
    expect(
      resolveSectionHeader({ title: "Sub", id: "sub", level: 3 }),
    ).toMatchObject({
      id: "sub",
      level: 3,
      headingTag: "h3",
    });
  });

  it("rejects an out-of-range level", () => {
    expect(() =>
      resolveSectionHeader({ title: "X", level: 4 as 2 | 3 }),
    ).toThrow("level must be 2 or 3");
  });

  it.each(["", "   "])("rejects a blank title %j", (title) => {
    expect(() => resolveSectionHeader({ title })).toThrow(
      "title must be non-empty",
    );
  });

  it("adds safe target/rel attributes to an external CTA link", () => {
    const resolved = resolveSectionHeader({
      title: "See more",
      link: { href: "https://example.com", label: "Visit", external: true },
    });

    expect(resolved.link).toEqual({
      href: "https://example.com",
      label: "Visit",
      external: true,
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("omits target/rel for an internal CTA link", () => {
    const resolved = resolveSectionHeader({
      title: "Archive",
      link: { href: "/archive/", label: "Browse" },
    });

    expect(resolved.link).toEqual({
      href: "/archive/",
      label: "Browse",
      external: false,
    });
  });

  it.each([
    { href: " ", label: "Ok", field: "link href" },
    { href: "/ok/", label: " ", field: "link label" },
  ])("rejects a blank $field", ({ href, label }) => {
    expect(() =>
      resolveSectionHeader({ title: "T", link: { href, label } }),
    ).toThrow("must be non-empty");
  });
});
