import { describe, expect, it } from "vitest";
import {
  CHAT_BUBBLE_COLOR_CLASSES,
  chatBubbleColorClass,
} from "../../src/logic/chat.ts";

describe("ChatBubble component helpers", () => {
  it("leaves the bubble on its default theme surface when color is omitted", () => {
    expect(chatBubbleColorClass(undefined)).toBeUndefined();
  });

  it.each(Object.entries(CHAT_BUBBLE_COLOR_CLASSES))(
    "maps %s to %s",
    (color, expectedClass) => {
      expect(
        chatBubbleColorClass(color as keyof typeof CHAT_BUBBLE_COLOR_CLASSES),
      ).toBe(expectedClass);
    },
  );
});
