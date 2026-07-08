import type { AstroIntegrationLogger } from "astro";
import fsAsync from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ChartOption, ChartTheme } from "./registry.ts";
import { renderEChartSvg } from "./server.ts";
import { chartHash } from "./serialization.ts";
import {
  ECHARTS_ASSET_BASE,
  ECHARTS_PACKAGE_VERSION,
  ECHARTS_RENDERER_VERSION,
} from "./constants.ts";

interface RegisterSvgArtifactArgs {
  option: ChartOption;
  width: number;
  height: number;
  theme?: ChartTheme | undefined;
  cacheKey?: string | undefined;
}

export interface RegisteredSvgArtifact {
  href: string;
  key: string;
  svg?: string;
}

interface ChartSvgAsset {
  href: string;
  svg: string;
}

interface EChartArtifactStore {
  svgAssets: Map<string, ChartSvgAsset>;
  collectingBuildAssets: boolean;
}

const globalArtifactStore = globalThis as typeof globalThis & {
  __BLOOMWRIGHT_ECHART_ARTIFACTS__?: EChartArtifactStore;
};

const artifactStore =
  globalArtifactStore.__BLOOMWRIGHT_ECHART_ARTIFACTS__ ??
  (globalArtifactStore.__BLOOMWRIGHT_ECHART_ARTIFACTS__ = {
    svgAssets: new Map<string, ChartSvgAsset>(),
    collectingBuildAssets: false,
  });

export function resetEChartArtifacts(): void {
  artifactStore.svgAssets.clear();
}

export function setEChartArtifactBuildMode(active: boolean): void {
  artifactStore.collectingBuildAssets = active;
}

export function getChartArtifactHash(args: RegisterSvgArtifactArgs): string {
  return chartHash({
    kind: "echart-svg",
    render: "svg-file",
    rendererVersion: ECHARTS_RENDERER_VERSION,
    echartsVersion: ECHARTS_PACKAGE_VERSION,
    option: args.option,
    width: args.width,
    height: args.height,
    theme: args.theme,
    cacheKey: args.cacheKey,
  });
}

export function registerEChartSvgArtifact(
  args: RegisterSvgArtifactArgs,
): RegisteredSvgArtifact {
  const key = getChartArtifactHash(args);
  const href = `${ECHARTS_ASSET_BASE}/${key}.svg`;

  if (!artifactStore.collectingBuildAssets) {
    return {
      href,
      key,
      svg: renderEChartSvg(args),
    };
  }

  if (!artifactStore.svgAssets.has(key)) {
    artifactStore.svgAssets.set(key, {
      href,
      svg: renderEChartSvg(args),
    });
  }

  return { href, key };
}

export async function emitEChartArtifacts(
  outDir: URL,
  logger?: AstroIntegrationLogger,
): Promise<void> {
  if (artifactStore.svgAssets.size === 0) return;

  const root = path.join(fileURLToPath(outDir), "_app", "charts");
  await fsAsync.mkdir(root, { recursive: true });

  await Promise.all(
    Array.from(artifactStore.svgAssets.entries()).map(([key, asset]) =>
      fsAsync.writeFile(path.join(root, `${key}.svg`), asset.svg, "utf-8"),
    ),
  );

  logger?.info(`Emitted ${artifactStore.svgAssets.size} ECharts SVG asset(s).`);
}
