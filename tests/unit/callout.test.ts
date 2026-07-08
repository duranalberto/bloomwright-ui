import { describe, expect, it } from "vitest";
import type { Icon } from "../../src/types/icon.ts";
import {
  CALLOUT_VARIANTS,
  calloutPaletteStyle,
  resolveCallout,
  type CalloutVariant,
} from "../../src/logic/callout.ts";

describe("Callout component helpers", () => {
  it.each(Object.entries(CALLOUT_VARIANTS))(
    "resolves the %s defaults",
    (variant, config) => {
      const resolved = resolveCallout(
        variant as CalloutVariant,
        undefined,
        undefined,
        undefined,
      );

      expect(resolved).toMatchObject({
        variant,
        title: config.title,
        className: config.className,
        icon: config.icon,
        paletteStyle: undefined,
      });
    },
  );

  it("uses custom titles and icons without changing the variant", () => {
    const icon: Icon = {
      text: "Custom",
      viewBox: "0 0 24 24",
      content: '<path d="M4 12h16"/>',
    };

    expect(
      resolveCallout("warning", "Deployment risk", icon, undefined),
    ).toMatchObject({
      variant: "warning",
      title: "Deployment risk",
      className: "callout-warning",
      icon,
    });
  });

  it("serializes every palette region to scoped CSS properties", () => {
    expect(
      calloutPaletteStyle({
        accent: "var(--color-accent)",
        surface: "var(--color-base-200)",
        border: "var(--color-base-300)",
        title: "var(--color-base-content)",
        content: "var(--color-base-content)",
        icon: "var(--color-accent)",
        iconSurface: "var(--color-base-100)",
      }),
    ).toBe(
      "--callout-accent: var(--color-accent); --callout-surface: var(--color-base-200); --callout-border: var(--color-base-300); --callout-title: var(--color-base-content); --callout-content: var(--color-base-content); --callout-icon: var(--color-accent); --callout-icon-surface: var(--color-base-100);",
    );
  });

  it.each(["", " "])("rejects blank custom titles", (title) => {
    expect(() => resolveCallout("note", title, undefined, undefined)).toThrow(
      "title must be non-empty",
    );
  });

  it("rejects invalid runtime variants", () => {
    expect(() =>
      resolveCallout(
        "unknown" as CalloutVariant,
        undefined,
        undefined,
        undefined,
      ),
    ).toThrow('invalid variant "unknown"');
  });

  it("rejects blank and unknown palette values", () => {
    expect(() => calloutPaletteStyle({ accent: " " })).toThrow(
      "accent must be a non-empty CSS value",
    );
    expect(() => calloutPaletteStyle({ mystery: "red" } as never)).toThrow(
      'unknown property "mystery"',
    );
  });
});
