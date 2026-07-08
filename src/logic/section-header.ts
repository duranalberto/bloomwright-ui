export interface SectionHeaderLink {
  href: string;
  label: string;
  external?: boolean | undefined;
}

export interface SectionHeaderInput {
  title: string;
  id?: string | undefined;
  level?: 2 | 3 | undefined;
  link?: SectionHeaderLink | undefined;
}

export interface ResolvedSectionHeader {
  title: string;
  id?: string | undefined;
  level: 2 | 3;
  headingTag: "h2" | "h3";
  link?: {
    href: string;
    label: string;
    external: boolean;
    target?: "_blank";
    rel?: "noopener noreferrer";
  };
}

function requireNonEmpty(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`SectionHeader ${label} must be non-empty.`);
  }

  return value.trim();
}

export function resolveSectionHeader(
  input: SectionHeaderInput,
): ResolvedSectionHeader {
  const level = input.level ?? 2;

  if (level !== 2 && level !== 3) {
    throw new Error("SectionHeader level must be 2 or 3.");
  }

  const link = input.link
    ? {
        href: requireNonEmpty(input.link.href, "link href"),
        label: requireNonEmpty(input.link.label, "link label"),
        external: input.link.external ?? false,
        ...(input.link.external
          ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
          : {}),
      }
    : undefined;

  return {
    title: requireNonEmpty(input.title, "title"),
    id: input.id,
    level,
    headingTag: level === 3 ? "h3" : "h2",
    ...(link ? { link } : {}),
  };
}
