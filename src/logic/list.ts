import type { ImageMetadata } from "astro";

export const LIST_STATUS_COLOR_CLASSES = {
  neutral: "badge-neutral",
  primary: "badge-primary",
  secondary: "badge-secondary",
  accent: "badge-accent",
  info: "badge-info",
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
} as const;

export type ListStatusColor = keyof typeof LIST_STATUS_COLOR_CLASSES;

export type ListItemMedia =
  | {
      kind: "image";
      src: ImageMetadata;
      alt: string;
      class?: string;
    }
  | {
      kind: "marker";
      label: string;
      class?: string;
    };

export interface ListStatus {
  label: string;
  color?: ListStatusColor;
  class?: string;
}

export interface ListAction {
  label: string;
  href: string;
  ariaLabel?: string;
  external?: boolean;
  class?: string;
}

export interface ListItem {
  title: string;
  href?: string;
  ariaLabel?: string;
  subtitle?: string;
  description?: string;
  media?: ListItemMedia;
  status?: ListStatus;
  action?: ListAction;
  class?: string;
  contentClass?: string;
}

export interface ResolvedListItem extends ListItem {
  statusClass: (typeof LIST_STATUS_COLOR_CLASSES)[ListStatusColor] | undefined;
  actionAttributes: {
    target?: "_blank";
    rel?: "noopener noreferrer";
  };
}

function requireText(value: string, field: string, index: number): void {
  if (value.trim().length === 0) {
    throw new Error(`List item ${index + 1} requires a non-empty ${field}.`);
  }
}

export function listStatusColorClass(
  color: ListStatusColor | undefined,
): (typeof LIST_STATUS_COLOR_CLASSES)[ListStatusColor] | undefined {
  return color ? LIST_STATUS_COLOR_CLASSES[color] : undefined;
}

export function listActionAttributes(action: ListAction | undefined): {
  target?: "_blank";
  rel?: "noopener noreferrer";
} {
  return action?.external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
}

export function resolveListItems(items: ListItem[]): ResolvedListItem[] {
  if (items.length === 0) {
    throw new Error("List requires at least one item.");
  }

  return items.map((item, index) => {
    requireText(item.title, "title", index);

    if (item.media?.kind === "marker") {
      requireText(item.media.label, "media marker label", index);
    }

    if (item.status) {
      requireText(item.status.label, "status label", index);
    }

    if (item.action) {
      requireText(item.action.label, "action label", index);
      requireText(item.action.href, "action href", index);
    }

    if (item.href) {
      requireText(item.href, "href", index);
    }

    return {
      ...item,
      statusClass: listStatusColorClass(item.status?.color),
      actionAttributes: listActionAttributes(item.action),
    };
  });
}
