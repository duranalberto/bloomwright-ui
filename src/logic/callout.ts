import type { Icon } from "../types/icon.ts";

export interface CalloutPalette {
  accent: string;
  surface: string;
  border: string;
  title: string;
  content: string;
  icon: string;
  iconSurface: string;
}

interface CalloutVariantConfig {
  title: string;
  className: string;
  icon: Icon;
}

const strokeIcon = (content: string): Icon => ({
  text: "",
  viewBox: "0 0 24 24",
  content,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export const CALLOUT_VARIANTS = {
  note: {
    title: "Notes",
    className: "callout-note",
    icon: strokeIcon(
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    ),
  },
  information: {
    title: "Information",
    className: "callout-information",
    icon: strokeIcon(
      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    ),
  },
  warning: {
    title: "Warning",
    className: "callout-warning",
    icon: strokeIcon(
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    ),
  },
  caution: {
    title: "Caution",
    className: "callout-caution",
    icon: strokeIcon(
      '<path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86Z"/><path d="M12 8v4M12 16h.01"/>',
    ),
  },
  error: {
    title: "Error",
    className: "callout-error",
    icon: strokeIcon(
      '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    ),
  },
} as const satisfies Record<string, CalloutVariantConfig>;

export type CalloutVariant = keyof typeof CALLOUT_VARIANTS;

const PALETTE_PROPERTIES = {
  accent: "--callout-accent",
  surface: "--callout-surface",
  border: "--callout-border",
  title: "--callout-title",
  content: "--callout-content",
  icon: "--callout-icon",
  iconSurface: "--callout-icon-surface",
} as const satisfies Record<keyof CalloutPalette, string>;

export interface ResolvedCallout {
  variant: CalloutVariant;
  title: string;
  className: string;
  icon: Icon;
  paletteStyle: string | undefined;
}

export function calloutPaletteStyle(
  palette: Partial<CalloutPalette> | undefined,
): string | undefined {
  if (!palette) return undefined;

  const declarations = Object.entries(palette).map(([key, value]) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Callout palette ${key} must be a non-empty CSS value.`);
    }

    const property = PALETTE_PROPERTIES[key as keyof CalloutPalette];
    if (!property) {
      throw new Error(`Callout palette contains an unknown property "${key}".`);
    }

    return `${property}: ${value.trim()}`;
  });

  return declarations.length > 0 ? `${declarations.join("; ")};` : undefined;
}

export function resolveCallout(
  variant: CalloutVariant,
  title: string | undefined,
  icon: Icon | undefined,
  palette: Partial<CalloutPalette> | undefined,
): ResolvedCallout {
  if (!(variant in CALLOUT_VARIANTS)) {
    throw new Error(`Callout received an invalid variant "${variant}".`);
  }

  if (title !== undefined && title.trim().length === 0) {
    throw new Error("Callout title must be non-empty when provided.");
  }

  const config = CALLOUT_VARIANTS[variant];

  return {
    variant,
    title: title?.trim() ?? config.title,
    className: config.className,
    icon: icon ?? config.icon,
    paletteStyle: calloutPaletteStyle(palette),
  };
}
