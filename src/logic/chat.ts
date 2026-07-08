export const CHAT_BUBBLE_COLOR_CLASSES = {
  neutral: "chat-bubble-neutral",
  primary: "chat-bubble-primary",
  secondary: "chat-bubble-secondary",
  accent: "chat-bubble-accent",
  info: "chat-bubble-info",
  success: "chat-bubble-success",
  warning: "chat-bubble-warning",
  error: "chat-bubble-error",
} as const;

export type ChatBubbleColor = keyof typeof CHAT_BUBBLE_COLOR_CLASSES;

export function chatBubbleColorClass(
  color: ChatBubbleColor | undefined,
): (typeof CHAT_BUBBLE_COLOR_CLASSES)[ChatBubbleColor] | undefined {
  return color ? CHAT_BUBBLE_COLOR_CLASSES[color] : undefined;
}
