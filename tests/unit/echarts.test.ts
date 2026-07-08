import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import {
  emitEChartArtifacts,
  getChartArtifactHash,
  registerEChartSvgArtifact,
  resetEChartArtifacts,
  setEChartArtifactBuildMode,
} from "../../src/echarts/artifacts";
import { applyClientOptionPreset } from "../../src/echarts/client-presets";
import {
  normalizeChartHydration,
  normalizeChartRenderMode,
} from "../../src/echarts/component";
import {
  getChartSeriesTypes,
  loadChartModules,
} from "../../src/echarts/client-core";
import {
  barChartOption,
  bollingerBandsChartOption,
  boxplotChartOption,
  calculateBollingerBands,
  calculateHistogramBins,
  calculateMacd,
  calculateRsi,
  candlestickWithVolumeOption,
  correlationHeatmapChartOption,
  depthChartOption,
  heatmapChartOption,
  histogramChartOption,
  lineChartOption,
  macdChartOption,
  ohlcChartOption,
  orderBookChartOption,
  pieChartOption,
  rsiChartOption,
  sankeyChartOption,
  scatterChartOption,
  treemapChartOption,
  type CandleVolumeDatum,
} from "../../src/echarts/options";
import {
  renderEChartSvg,
  withChartAriaDefaults,
} from "../../src/echarts/server";
import {
  assertSerializableChartOption,
  chartHash,
  serializeChartOption,
} from "../../src/echarts/serialization";

const financeData: CandleVolumeDatum[] = [
  { date: "2026-01-01", open: 10, close: 12, low: 9, high: 13, volume: 100 },
  { date: "2026-01-02", open: 12, close: 11, low: 10, high: 14, volume: 110 },
  { date: "2026-01-03", open: 11, close: 14, low: 11, high: 15, volume: 130 },
  { date: "2026-01-04", open: 14, close: 16, low: 13, high: 17, volume: 150 },
  { date: "2026-01-05", open: 16, close: 15, low: 14, high: 18, volume: 120 },
  { date: "2026-01-06", open: 15, close: 18, low: 15, high: 19, volume: 160 },
];

afterEach(() => {
  setEChartArtifactBuildMode(false);
  resetEChartArtifacts();
});

describe("ECharts component API helpers", () => {
  it("normalizes render and hydration aliases", () => {
    expect(normalizeChartRenderMode(undefined)).toBe("svg-inline");
    expect(normalizeChartRenderMode("svg-file")).toBe("svg-file");
    expect(normalizeChartHydration({ enhance: "visible" })).toBe("visible");
    expect(
      normalizeChartHydration({
        hydrate: "media",
        media: "(min-width: 900px)",
      }),
    ).toBe("media");
  });

  it("rejects deferred or conflicting modes", () => {
    expect(() => normalizeChartRenderMode("png-file")).toThrow(/deferred/);
    expect(() => normalizeChartHydration({ hydrate: "light" })).toThrow(
      /deferred/,
    );
    expect(() =>
      normalizeChartHydration({ hydrate: "idle", enhance: "visible" }),
    ).toThrow(/conflicts/);
    expect(() => normalizeChartHydration({ hydrate: "media" })).toThrow(
      /requires/,
    );
  });

  it("discovers and deduplicates client series capabilities", () => {
    expect(
      getChartSeriesTypes({
        series: [
          { type: "line", data: [1] },
          { type: "bar", data: [2] },
          { type: "line", data: [3] },
        ],
      }),
    ).toEqual(["line", "bar"]);
  });

  it("loads supported client modules and rejects unknown series", async () => {
    await expect(
      loadChartModules({ series: [{ type: "heatmap", data: [] }] }),
    ).resolves.toBeUndefined();
    await expect(
      loadChartModules({ series: [{ type: "unsupported-chart", data: [] }] }),
    ).rejects.toThrow(/unsupported-chart/);
  });
});

describe("ECharts SSR utilities", () => {
  it("renders an inline SVG string at build time", () => {
    const option = lineChartOption({
      x: ["Q1", "Q2", "Q3"],
      y: [1, 2, 3],
      title: "Revenue",
      name: "Revenue",
    });

    const svg = renderEChartSvg({ option, width: 480, height: 280 });

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("Revenue");
  });

  it("adds ARIA defaults while allowing the prop-level ARIA override to win", () => {
    const option = withChartAriaDefaults(
      {
        aria: { show: false, description: "Option description" },
        series: [{ type: "pie", data: [{ name: "A", value: 1 }] }],
      },
      "Default summary",
      { show: true, description: "Prop description", decal: { show: true } },
    );

    expect(option.aria).toMatchObject({
      show: true,
      description: "Prop description",
      decal: { show: true },
    });
  });

  it("hashes objects stably regardless of key insertion order", () => {
    expect(chartHash({ b: 2, a: 1 })).toBe(chartHash({ a: 1, b: 2 }));
  });

  it("serializes JSON-compatible chart options", () => {
    const serialized = serializeChartOption({
      series: [{ type: "bar", data: [1, 2, 3] }],
    });

    expect(JSON.parse(serialized)).toEqual({
      series: [{ type: "bar", data: [1, 2, 3] }],
    });
  });

  it("rejects non-serializable enhanced chart options", () => {
    expect(() =>
      assertSerializableChartOption({
        tooltip: {
          formatter: () => "unsafe for hydration props",
        },
      }),
    ).toThrow(/function/);

    expect(() =>
      assertSerializableChartOption({
        series: [Number.NaN],
      }),
    ).toThrow(/finite/);
  });
});

describe("ECharts SVG artifacts", () => {
  it("hashes artifact input with theme, render mode, and cache key", () => {
    const option = lineChartOption({ x: ["A"], y: [1] });
    const base = getChartArtifactHash({ option, width: 320, height: 200 });

    expect(base).toBe(
      getChartArtifactHash({ option, width: 320, height: 200 }),
    );
    expect(base).not.toBe(
      getChartArtifactHash({
        option,
        width: 320,
        height: 200,
        cacheKey: "variant",
      }),
    );
    expect(base).not.toBe(
      getChartArtifactHash({
        option,
        width: 320,
        height: 200,
        theme: { color: ["#000000"] },
      }),
    );
  });

  it("returns inline SVG in dev mode and emits hashed SVG in build mode", async () => {
    const option = barChartOption({ x: ["A"], y: [1] });
    const devArtifact = registerEChartSvgArtifact({
      option,
      width: 320,
      height: 200,
    });

    expect(devArtifact.href).toMatch(/^\/_app\/charts\/[a-f0-9]+\.svg$/);
    expect(devArtifact.svg).toContain("<svg");

    setEChartArtifactBuildMode(true);
    const buildArtifact = registerEChartSvgArtifact({
      option,
      width: 320,
      height: 200,
      cacheKey: "unit-test",
    });
    const outDir = await mkdtemp(path.join(tmpdir(), "echarts-artifacts-"));

    try {
      expect(buildArtifact.svg).toBeUndefined();
      await emitEChartArtifacts(new URL(`file://${outDir}/`));
      const fileName = path.basename(buildArtifact.href);
      const emitted = await readFile(
        path.join(outDir, "_app", "charts", fileName),
        "utf-8",
      );
      expect(emitted).toContain("<svg");
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});

describe("ECharts client option presets", () => {
  it("rebuilds formatter callbacks from named presets", () => {
    const option = applyClientOptionPreset(
      { yAxis: {}, tooltip: {}, series: [{ type: "bar", data: [12] }] },
      "currency",
    ) as Record<string, any>;

    expect(typeof option.tooltip.valueFormatter).toBe("function");
    expect(option.tooltip.valueFormatter(12)).toBe("$12.00");
    expect(typeof option.yAxis.axisLabel.formatter).toBe("function");
  });
});

describe("ECharts option builders", () => {
  it("builds common chart helpers", () => {
    const line = lineChartOption({ x: ["A"], y: [1] });
    const bar = barChartOption({ x: ["A"], y: [1], horizontal: true });
    const pie = pieChartOption({
      donut: true,
      rose: "area",
      data: [{ name: "A", value: 1 }],
    });
    const heatmap = heatmapChartOption({
      x: ["A"],
      y: ["B"],
      data: [[0, 0, 1]],
    });
    const scatter = scatterChartOption({ data: [[1, 2]] });
    const histogram = histogramChartOption({ values: [1, 2, 2, 4], bins: 2 });
    const treemap = treemapChartOption({
      data: [{ name: "A", value: 1 }],
    });
    const sankey = sankeyChartOption({
      nodes: [{ name: "A" }, { name: "B" }],
      links: [{ source: "A", target: "B", value: 1 }],
    });
    const boxplot = boxplotChartOption({
      data: [{ name: "A", min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
    });
    const correlation = correlationHeatmapChartOption({
      x: ["A"],
      y: ["A"],
      data: [[0, 0, 1]],
    });

    expect(line.series).toMatchObject([{ type: "line" }]);
    expect(bar.series).toMatchObject([{ type: "bar" }]);
    expect(pie.series).toMatchObject([{ type: "pie", roseType: "area" }]);
    expect(heatmap.series).toMatchObject([{ type: "heatmap" }]);
    expect(scatter.series).toMatchObject([{ type: "scatter" }]);
    expect(histogram.series).toMatchObject([{ type: "bar" }]);
    expect(treemap.series).toMatchObject([{ type: "treemap" }]);
    expect(sankey.series).toMatchObject([{ type: "sankey" }]);
    expect(boxplot.series).toMatchObject([{ type: "boxplot" }]);
    expect(correlation.series).toMatchObject([{ type: "heatmap" }]);

    [
      line,
      bar,
      pie,
      heatmap,
      scatter,
      histogram,
      treemap,
      sankey,
      boxplot,
      correlation,
    ].forEach((option) => {
      expect(() => assertSerializableChartOption(option)).not.toThrow();
    });
  });

  it("builds finance chart helpers and deterministic indicator data", () => {
    const candle = candlestickWithVolumeOption({ data: financeData });
    const macd = macdChartOption({ data: financeData });
    const rsi = rsiChartOption({ data: financeData });
    const bollinger = bollingerBandsChartOption({ data: financeData });
    const depth = depthChartOption({
      bids: [{ price: 10, size: 1 }],
      asks: [{ price: 11, size: 2 }],
    });
    const orderBook = orderBookChartOption({
      bids: [{ price: 10, size: 1 }],
      asks: [{ price: 11, size: 2 }],
    });
    const ohlc = ohlcChartOption({ data: financeData });

    expect(candle.series).toMatchObject([
      { type: "candlestick" },
      { type: "bar" },
    ]);
    expect(macd.series).toMatchObject([
      { type: "candlestick" },
      { type: "bar" },
      { type: "bar" },
      { type: "line" },
      { type: "line" },
    ]);
    expect(rsi.series).toMatchObject([{ type: "line" }, { type: "line" }]);
    expect(bollinger.series).toHaveLength(4);
    expect(depth.series).toMatchObject([{ type: "line" }, { type: "line" }]);
    expect(orderBook.series).toMatchObject([{ type: "bar" }, { type: "bar" }]);
    expect(ohlc.series).toMatchObject([{ type: "custom" }]);

    expect(calculateMacd([10, 12, 11, 14])).toEqual([
      { macd: 0, signal: 0, histogram: 0 },
      { macd: 0.1596, signal: 0.0319, histogram: 0.1277 },
      { macd: 0.203, signal: 0.0661, histogram: 0.1369 },
      { macd: 0.474, signal: 0.1477, histogram: 0.3263 },
    ]);
    expect(calculateRsi([10, 12, 11, 14], 3)).toEqual([
      { value: 50 },
      { value: 100 },
      { value: 66.67 },
      { value: 83.33 },
    ]);
    expect(calculateBollingerBands([10, 12, 11], 3, 2)).toEqual([
      { lower: 10, middle: 10, upper: 10 },
      { lower: 9, middle: 11, upper: 13 },
      { lower: 9.367, middle: 11, upper: 12.633 },
    ]);
  });

  it("calculates histogram bins deterministically", () => {
    expect(calculateHistogramBins([1, 2, 2, 4], 2)).toEqual([
      { label: "1-2.5", min: 1, max: 2.5, count: 3 },
      { label: "2.5-4", min: 2.5, max: 4, count: 1 },
    ]);
  });

  it("throws when paired category and value arrays differ", () => {
    expect(() => lineChartOption({ x: ["A"], y: [1, 2] })).toThrow(
      /length mismatch/,
    );
  });
});
