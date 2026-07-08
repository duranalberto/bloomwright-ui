/**
 * constants.ts
 *
 * Build-time constants shared across the mermaid integration.
 *
 * ## RENDERER_VERSION
 * Seeds the SHA-256 cache key together with the diagram source code.
 * Bump this value whenever a change would produce different SVG output
 * for the same input code — e.g.:
 *   - theme generation logic in theme.ts changes
 *   - transform / SVG post-processing logic in transform.ts changes
 *   - a new Mermaid version is deployed to the Cloudflare Worker
 *
 * Leaving it stale causes the disk cache to serve SVGs built with
 * old logic without re-rendering.
 *
 * v4.2 — normalizesvgIntrinsicSize: SVG width="100%" replaced with
 *         pixel value from viewBox so CSS width: auto resolves to the
 *         diagram's natural dimensions rather than filling the container.
 *
 * v4.3 — standalone SVG assets receive a theme-matching background while
 *         inline publication SVGs remain transparent.
 *
 * v4.4 — remote cached standalone SVG assets correctly strip previously
 *         injected background rects before re-emitting light/dark variants.
 *
 * v4.5 — normalizes Worker SVG foreignObject line breaks and keeps Mermaid
 *         :root rules unscoped so production HTML labels stay inside nodes.
 *
 * v4.6 — preserves Mermaid style cascade order inside emitted SVG assets and
 *         invalidates immutable SVG URLs emitted with older style processing.
 *
 * v4.7 — mermaid.ink fallback path now sends the palette's fontFamily as a
 *         top-level Mermaid config key (not just inside themeVariables), so
 *         node/label boxes are measured and rendered with the correct font
 *         instead of silently falling back to Mermaid's default font stack.
 *
 * v4.8 — Cloudflare Worker's render loop now prepares each item's page once
 *         (instead of once per theme) and resets the DOM between themes
 *         instead of reloading scripts, fixing chunk-request timeouts. Bump
 *         covers the (expected-null but unverified) chance that removing the
 *         per-theme full page reload subtly changes output bytes.
 */
export const RENDERER_VERSION = "v4.9";

/**
 * Default subfolder (inside .astro/) for the on-disk SVG cache.
 * Shared between integration.ts (which writes here during
 * astro:build:start) and build-context.ts (which reads here at Astro
 * component render time — a separate process/module instance during
 * static-site prerendering, so it cannot rely on in-memory state).
 */
export const DEFAULT_MERMAID_CACHE_SUBDIR = "mermaid-cache";

/**
 * Default subfolder (inside .astro/) for the per-build prepared-diagram
 * manifest. Unlike the SVG cache above, this holds every prepared diagram —
 * including render-failure placeholders, which are deliberately never
 * written to the permanent SVG cache so a transient outage gets retried on
 * the next build. MermaidDiagram.astro reads this manifest (not the SVG
 * cache) during static-output prerendering, so a render-service outage
 * degrades to visible fallback placeholders instead of crashing the build.
 */
export const DEFAULT_MERMAID_MANIFEST_SUBDIR = "mermaid-manifest";

/**
 * Debounce window (ms) before the collected batch is flushed to the
 * render service.  Gives all concurrent remark pipelines time to register
 * their diagrams so a single network round-trip handles the whole build.
 */
export const FLUSH_DEBOUNCE_MS = 800;

/**
 * Maximum number of diagrams sent in a single Worker request.
 *
 * This is sized by render *time*, not payload size: the worker renders one
 * Chromium page per item, sequentially, within a single request. Measured
 * against the live worker (2 themes/item): 10 items ≈ 12s, 20 items ≈ 29.5s
 * server-side — worse than linear, so 40 items (the old value, picked purely
 * for the ~900 KB JSON payload cap) comfortably exceeds
 * WORKER_RENDER_TIMEOUT_MS on renderers.ts and aborts the whole chunk,
 * falling back to mermaid.ink. 15 keeps chunks well under that budget even
 * for heavier real diagrams than the flat test cases measured above.
 */
export const CHUNK_SIZE = 15;

/**
 * Pause between Worker chunk requests (ms).
 * Respects the Cloudflare Worker's rate limit.
 * Not used when the MermaidInk service is active — Ink serialises
 * its own requests internally with a per-fetch courtesy delay.
 */
export const INTER_CHUNK_DELAY_MS = 22_000;
