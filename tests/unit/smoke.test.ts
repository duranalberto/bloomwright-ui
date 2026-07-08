import { describe, it, expect } from "vitest";
import type { Icon } from "../../src/index.ts";

/**
 * Baseline smoke test so the repo is green from day one (ticket BUI-001).
 * Real resolver suites (callout/chat/list/steps/section-header) land in BUI-003.
 */
describe("bloomwright-ui baseline", () => {
  it("exposes the Icon type contract from the barrel", () => {
    const icon: Icon = { text: "", viewBox: "0 0 24 24", content: "<path/>" };
    expect(icon.viewBox).toBe("0 0 24 24");
  });
});
