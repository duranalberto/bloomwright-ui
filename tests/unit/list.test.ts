import { describe, expect, it } from "vitest";
import type { ImageMetadata } from "astro";
import {
  LIST_STATUS_COLOR_CLASSES,
  listActionAttributes,
  listStatusColorClass,
  resolveListItems,
  type ListItem,
} from "../../src/logic/list.ts";

const image = {
  src: "/image.png",
  width: 80,
  height: 80,
  format: "png",
} as ImageMetadata;

describe("List component helpers", () => {
  it("requires at least one item", () => {
    expect(() => resolveListItems([])).toThrow("at least one item");
  });

  it.each(
    (
      [
        [{ title: " " }],
        [{ title: "Item", media: { kind: "marker", label: "" } }],
        [{ title: "Item", status: { label: " " } }],
        [{ title: "Item", action: { label: "", href: "/" } }],
        [{ title: "Item", action: { label: "Read", href: " " } }],
      ] satisfies ListItem[][]
    ).map((items) => [items] as const),
  )("rejects invalid required text in %j", (items) => {
    expect(() => resolveListItems(items)).toThrow("requires a non-empty");
  });

  it.each(Object.entries(LIST_STATUS_COLOR_CLASSES))(
    "maps %s to %s",
    (color, expectedClass) => {
      expect(
        listStatusColorClass(color as keyof typeof LIST_STATUS_COLOR_CLASSES),
      ).toBe(expectedClass);
    },
  );

  it("leaves an uncolored status on the default badge surface", () => {
    expect(listStatusColorClass(undefined)).toBeUndefined();
  });

  it("adds safe attributes only to external actions", () => {
    expect(
      listActionAttributes({
        label: "Reference",
        href: "https://example.com",
        external: true,
      }),
    ).toEqual({ target: "_blank", rel: "noopener noreferrer" });
    expect(
      listActionAttributes({ label: "Journal", href: "/thejournal/" }),
    ).toEqual({});
  });

  it("preserves image and marker media with optional row content", () => {
    const resolved = resolveListItems([
      {
        title: "Image row",
        subtitle: "Local asset",
        media: { kind: "image", src: image, alt: "Example" },
      },
      {
        title: "Marker row",
        description: "A wrapped description",
        media: { kind: "marker", label: "02" },
        status: { label: "Ready", color: "success" },
        action: { label: "Open", href: "/open/" },
        class: "custom-row",
        contentClass: "custom-content",
      },
    ]);

    expect(resolved[0]?.media).toMatchObject({ kind: "image", src: image });
    expect(resolved[1]).toMatchObject({
      description: "A wrapped description",
      media: { kind: "marker", label: "02" },
      statusClass: LIST_STATUS_COLOR_CLASSES.success,
      actionAttributes: {},
      class: "custom-row",
      contentClass: "custom-content",
    });
  });
});
