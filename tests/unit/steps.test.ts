import { describe, expect, it } from "vitest";
import {
  resolveStepItems,
  STEP_COLOR_CLASSES,
  type StepItem,
} from "../../src/logic/steps.ts";

const items: StepItem[] = [
  { label: "Draft", marker: "1" },
  { label: "Review", marker: "2" },
  { label: "Publish", marker: "3" },
];

describe("Steps component helpers", () => {
  it("requires at least one step", () => {
    expect(() => resolveStepItems([], undefined, "primary")).toThrow(
      "at least one item",
    );
  });

  it.each([0, 4, 1.5, Number.NaN])(
    "rejects invalid currentStep value %s",
    (currentStep) => {
      expect(() => resolveStepItems(items, currentStep, "primary")).toThrow(
        "integer between 1 and 3",
      );
    },
  );

  it("colors the active path and marks only the current item", () => {
    const resolved = resolveStepItems(items, 2, "success");

    expect(resolved.map((item) => item.colorClass)).toEqual([
      STEP_COLOR_CLASSES.success,
      STEP_COLOR_CLASSES.success,
      undefined,
    ]);
    expect(resolved.map((item) => item.isCurrent)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("gives explicit item colors precedence over the active color", () => {
    const resolved = resolveStepItems(
      [items[0]!, { ...items[1]!, color: "warning" }, items[2]!],
      2,
      "primary",
    );

    expect(resolved[0]?.colorClass).toBe(STEP_COLOR_CLASSES.primary);
    expect(resolved[1]?.colorClass).toBe(STEP_COLOR_CLASSES.warning);
  });

  it("preserves labels, markers, and classes without implicit coloring", () => {
    const resolved = resolveStepItems(
      [{ label: "Queued", marker: "?", class: "custom-step" }],
      undefined,
      "primary",
    );

    expect(resolved[0]).toMatchObject({
      label: "Queued",
      marker: "?",
      class: "custom-step",
      colorClass: undefined,
      isCurrent: false,
    });
  });
});
