/**
 * Content-selection contract (SPEC.md §6, ticket BMX-008).
 *
 * The Mermaid and ECharts integrations scan the project for source documents and
 * must decide WHICH documents' diagrams/charts to actually render and emit. That
 * decision is application-specific (e.g. "skip drafts"), so it is injected rather
 * than hard-coded. Omitting `selectSources` renders everything discovered — the
 * correct zero-config default for external consumers.
 */
export interface SourceDocument {
  filePath: string;
  content: string;
}

export interface ContentSelection {
  /**
   * Given every scanned document, return the subset whose diagrams/charts should
   * be rendered. Default: identity (render all).
   */
  selectSources?: (docs: SourceDocument[]) => SourceDocument[];
}

/** Default selection: render every discovered document. */
export const identitySelection = (docs: SourceDocument[]): SourceDocument[] => docs;

/**
 * Source-scan globs (SPEC §4.6 / FR-CFG). Controls WHICH files the build pre-scan
 * reads to discover fences and `defineMermaidDiagram()` calls. Injected so a
 * consumer with a different content layout can point the scan at its own roots
 * instead of the reference project's hardcoded `src/**` glob.
 */
export interface SourceScanOptions {
  /** @default ["src/**\/*.{md,mdx,astro,ts,tsx}"] */
  include?: string[];
  /** @default ["src/**\/*.d.ts"] */
  ignore?: string[];
}
