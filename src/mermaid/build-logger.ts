/**
 * build-logger.ts
 *
 * Build-time logging for the mermaid integration.
 *
 *
 * ## Lifecycle
 *   1. Construct a BuildLogger instance at astro:build:start.
 *   2. Call logDiagramResult() / logDiagramError() from the pipeline after
 *      each diagram is processed.
 *   3. Call logBuildSummary() at astro:build:done.
 */

import type { AstroIntegrationLogger } from "astro";
import { performance } from "node:perf_hooks";
import {
  bold,
  cyan,
  dim,
  green,
  magenta,
  red,
  timestamp,
  yellow,
} from "./ansi.ts";
import { RenderService } from "./types.ts";

export interface BuildLoggerConfig {
  /** True when the built-in fixture pipeline is active (no caller pipeline). */
  fixture: boolean;
  debug?: boolean | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DiagramResultParams {
  stableId: string;
  service: RenderService;
  /** Elapsed milliseconds for this diagram. */
  duration: number;
  themes: string[];
}

interface BuildStats {
  totalDiagrams: number;
  totalTimeMs: number;
  workerSuccess: number;
  inkSuccess: number;
  fallback: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// BuildLogger
// ─────────────────────────────────────────────────────────────────────────────

export class BuildLogger {
  private readonly startTime: number;
  private stats: BuildStats = {
    totalDiagrams: 0,
    totalTimeMs: 0,
    workerSuccess: 0,
    inkSuccess: 0,
    fallback: 0,
  };

  constructor(private readonly config: BuildLoggerConfig) {
    this.startTime = performance.now();
    this.logInit();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  logDiagramResult(params: DiagramResultParams): void {
    const { stableId, service, duration, themes } = params;
    const isCached = service === RenderService.Cache;

    this.stats.totalDiagrams++;
    this.stats.totalTimeMs += duration;

    if (service === RenderService.CloudflareWorker) this.stats.workerSuccess++;
    else if (service === RenderService.MermaidInk) this.stats.inkSuccess++;
    else if (!isCached) this.stats.fallback++;

    const durStr = isCached
      ? dim(`+${duration}ms`)
      : duration < 5_000
        ? green(`+${duration}ms`)
        : duration < 15_000
          ? yellow(`+${duration}ms`)
          : red(`+${duration}ms`);

    const methodFmt = isCached
      ? dim(service)
      : service === RenderService.FailurePlaceholder
        ? red(service)
        : service === RenderService.MermaidInk
          ? yellow(service)
          : cyan(service);

    const statusLabel =
      service === RenderService.CloudflareWorker
        ? bold("✓ Worker")
        : isCached
          ? "  Cached "
          : service === RenderService.MermaidInk
            ? "  Ink    "
            : "  Fallback";

    console.log(
      `${dim(timestamp())} ${magenta("[mermaid]")} ${stableId} | ${statusLabel} | ${methodFmt} | themes: ${themes.join(", ")} | ${durStr}`,
    );
  }

  logDiagramError(stableId: string, err: unknown): void {
    this.stats.fallback++;
    console.error(`[mermaid] Error rendering diagram ${stableId}:`, err);
  }

  logChunkDone(durationMs: number, service: string): void {
    console.log(
      `[mermaid:pipeline] Chunk done in ${Math.round(durationMs)}ms via ${service}`,
    );
  }

  logBatchFlush(count: number): void {
    console.log(`\n[mermaid:pipeline] Flushing batch: ${count} diagram(s)`);
  }

  logRateLimitPause(seconds: number): void {
    console.log(`[mermaid:pipeline] Rate-limit pause: ${seconds}s`);
  }

  /**
   * Emits the final build summary.
   * When an Astro integration logger is provided it is used; otherwise the
   * formatted string is written to stdout via console.log so the output is
   * identical regardless of call site.
   */
  logBuildSummary(logger?: AstroIntegrationLogger): void {
    if (this.stats.totalDiagrams === 0) return;

    const summary = this.formatSummary();

    if (logger) {
      logger.info(summary.oneLiner);
    } else {
      console.log(summary.detailed);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private logInit(): void {
    const { fixture, debug } = this.config;
    const primaryService = fixture
      ? "fixture SVGs (deterministic, no network)"
      : "caller-supplied render pipeline";

    const t = timestamp();
    console.log(
      `\n${dim(t)} ${magenta("[mermaid]")} ${green("Integration initialized")}`,
    );
    console.log(
      `${dim(t)} ${magenta("[mermaid]")} Primary render service: ${cyan(primaryService)}`,
    );

    console.log(
      `${dim(t)} ${magenta("[mermaid]")} Debug logging: ${debug ? cyan("ENABLED") : dim("disabled")}\n`,
    );
  }

  /**
   * Assembles the build summary as both a compact one-liner (for the Astro
   * logger) and a multi-line formatted block (for stdout).  Both are derived
   * from the same stats so they can never drift apart.
   */
  private formatSummary(): { oneLiner: string; detailed: string } {
    const { totalDiagrams, totalTimeMs, workerSuccess, inkSuccess, fallback } =
      this.stats;
    const totalTime = ((performance.now() - this.startTime) / 1000).toFixed(2);
    const avgTime = (totalTimeMs / totalDiagrams / 1000).toFixed(2);

    const oneLiner =
      `Build summary — ${totalDiagrams} diagram(s) | ` +
      `Worker: ${workerSuccess} | Ink: ${inkSuccess} | Fallback: ${fallback} | ` +
      `Total: ${totalTime}s | Avg: ${avgTime}s`;

    const t = timestamp();
    const detailed = [
      `\n${dim(t)} ${magenta("[mermaid]")} ${green("✓")} Build Summary`,
      `${dim(t)} ${magenta("[mermaid]")}   Diagrams:        ${cyan(String(totalDiagrams))}`,
      `${dim(t)} ${magenta("[mermaid]")}   Worker success:  ${green(String(workerSuccess))}`,
      `${dim(t)} ${magenta("[mermaid]")}   Ink success:     ${inkSuccess > 0 ? cyan(String(inkSuccess)) : dim("0")}`,
      `${dim(t)} ${magenta("[mermaid]")}   Fallback:        ${fallback > 0 ? red(String(fallback)) : green("0")}`,
      `${dim(t)} ${magenta("[mermaid]")}   Total time:      ${yellow(totalTime + "s")}`,
      `${dim(t)} ${magenta("[mermaid]")}   Avg per diagram: ${yellow(avgTime + "s")}\n`,
    ].join("\n");

    return { oneLiner, detailed };
  }
}
