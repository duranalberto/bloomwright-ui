import { describe, expect, it } from "vitest";
import { parseEChartFenceDefinition } from "../../src/echarts/definition";
import {
  compileEChartDefinition,
  ECHART_PRESET_TYPES,
} from "../../src/echarts/presets";
import { assertSerializableChartOption } from "../../src/echarts/serialization";

const financeData = [
  { date: "2026-01-01", open: 10, close: 12, low: 9, high: 13, volume: 100 },
  { date: "2026-01-02", open: 12, close: 11, low: 10, high: 14, volume: 110 },
  { date: "2026-01-03", open: 11, close: 14, low: 11, high: 15, volume: 130 },
  { date: "2026-01-04", open: 14, close: 16, low: 13, high: 17, volume: 150 },
  { date: "2026-01-05", open: 16, close: 15, low: 14, high: 18, volume: 120 },
  { date: "2026-01-06", open: 15, close: 18, low: 15, high: 19, volume: 160 },
];

function parseFixture(value: unknown) {
  return parseEChartFenceDefinition(JSON.stringify(value), {
    fileURL: new URL("file:///fixtures/article.mdx"),
    fenceLang: "echart",
  });
}

function fixtureFor(type: string): unknown {
  const figure = { description: `${type} chart` };

  switch (type) {
    case "line":
    case "area":
      return { type, figure, data: { x: ["A", "B"], y: [1, 2] } };
    case "bar":
      return { type, figure, data: { x: ["A", "B"], y: [1, 2] } };
    case "pie":
    case "donut":
    case "rose":
      return {
        type,
        figure,
        data: { data: [{ name: "A", value: 1 }] },
      };
    case "scatter":
      return { type, figure, data: { data: [[1, 2]] } };
    case "histogram":
      return { type, figure, data: { values: [1, 2, 2, 4], bins: 2 } };
    case "heatmap":
    case "correlation-heatmap":
      return { type, figure, data: { x: ["A"], y: ["B"], data: [[0, 0, 1]] } };
    case "treemap":
      return { type, figure, data: { data: [{ name: "A", value: 1 }] } };
    case "sankey":
      return {
        type,
        figure,
        data: {
          nodes: [{ name: "A" }, { name: "B" }],
          links: [{ source: "A", target: "B", value: 1 }],
        },
      };
    case "boxplot":
      return {
        type,
        figure,
        data: {
          data: [{ name: "A", min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
        },
      };
    case "candlestick-volume":
    case "macd":
    case "rsi":
    case "bollinger-bands":
    case "ohlc":
      return { type, figure, data: { data: financeData } };
    case "depth":
    case "order-book":
      return {
        type,
        figure,
        data: {
          bids: [{ price: 10, size: 1 }],
          asks: [{ price: 11, size: 2 }],
        },
      };
    case "option":
      return {
        type,
        figure,
        option: { xAxis: {}, yAxis: {}, series: [{ type: "bar", data: [1] }] },
      };
    default:
      throw new Error(`Missing fixture for ${type}.`);
  }
}

describe("ECharts fence definitions", () => {
  it("normalizes minimal valid fences", () => {
    const definition = parseFixture({
      type: "line",
      figure: { description: "Revenue by quarter" },
      data: { x: ["Q1"], y: [1] },
    });

    expect(definition).toMatchObject({
      version: 1,
      type: "line",
      width: 760,
      height: 420,
      render: "svg-inline",
      hydrate: "none",
    });
  });

  it("fails with source context for invalid JSON", () => {
    expect(() =>
      parseEChartFenceDefinition("{", {
        fileURL: new URL("file:///fixtures/broken.mdx"),
        fenceLang: "echart",
      }),
    ).toThrow(/echart fence in \/fixtures\/broken\.mdx: invalid JSON/);
  });

  it("rejects missing description, deferred modes, missing media, and non-finite numbers", () => {
    expect(() => parseFixture({ type: "line", figure: {} })).toThrow(
      /figure\.description/,
    );
    expect(() =>
      parseFixture({
        type: "line",
        figure: { description: "Deferred" },
        render: "png-file",
      }),
    ).toThrow(/deferred/);
    expect(() =>
      parseFixture({
        type: "line",
        figure: { description: "Deferred" },
        hydrate: "light",
      }),
    ).toThrow(/deferred/);
    expect(() =>
      parseFixture({
        type: "line",
        figure: { description: "Media" },
        hydrate: "media",
      }),
    ).toThrow(/requires/);
    expect(() =>
      parseEChartFenceDefinition(
        '{"type":"line","figure":{"description":"Bad"},"data":{"x":["A"],"y":[1e999]}}',
      ),
    ).toThrow(/finite number/);
  });

  it("compiles every supported preset to a serializable chart option", () => {
    for (const type of ECHART_PRESET_TYPES) {
      const definition = parseFixture(fixtureFor(type));
      const compiled = compileEChartDefinition(definition);

      expect(compiled.option).toHaveProperty("series");
      if (type === "ohlc") {
        expect(() => assertSerializableChartOption(compiled.option)).toThrow(
          /function/,
        );
      } else {
        expect(() =>
          assertSerializableChartOption(compiled.option),
        ).not.toThrow();
      }
    }
  });

  it("fails clearly for unknown presets and missing raw option input", () => {
    expect(() =>
      compileEChartDefinition(
        parseFixture({
          type: "radar",
          figure: { description: "Unknown" },
        }),
      ),
    ).toThrow(/Use one of/);

    expect(() =>
      compileEChartDefinition(
        parseFixture({
          type: "option",
          figure: { description: "Missing raw option" },
        }),
      ),
    ).toThrow(/requires an option object/);
  });

  it("supports multi-series line, area, and bar definitions", () => {
    const line = compileEChartDefinition(
      parseFixture({
        type: "line",
        figure: { description: "Growth" },
        data: {
          x: ["Now", "Next"],
          legend: { top: 0 },
          series: [
            { name: "Base", y: [1, 2] },
            { name: "Bull", y: [1, 3] },
          ],
        },
      }),
    ).option as Record<string, any>;
    const area = compileEChartDefinition(
      parseFixture({
        type: "area",
        figure: { description: "Growth" },
        data: {
          x: ["Now", "Next"],
          series: [{ name: "Base", y: [1, 2] }],
        },
      }),
    ).option as Record<string, any>;
    const bar = compileEChartDefinition(
      parseFixture({
        type: "bar",
        figure: { description: "Scenarios" },
        data: {
          x: ["DCF", "PE"],
          horizontal: true,
          series: [
            { name: "Bear", y: [1, 2] },
            { name: "Base", y: [3, 4] },
          ],
        },
      }),
    ).option as Record<string, any>;

    expect(line.series).toMatchObject([
      { name: "Base", type: "line" },
      { name: "Bull", type: "line" },
    ]);
    expect(line.legend).toEqual({ top: 0 });
    expect(area.series[0].areaStyle).toEqual({ opacity: 0.18 });
    expect(bar.series).toHaveLength(2);
    expect(bar.xAxis.type).toBe("value");
    expect(bar.yAxis.type).toBe("category");
  });

  it("points at the failing series when multi-series lengths differ", () => {
    expect(() =>
      compileEChartDefinition(
        parseFixture({
          type: "bar",
          figure: { description: "Mismatch" },
          data: {
            x: ["A", "B"],
            series: [{ name: "Broken", y: [1] }],
          },
        }),
      ),
    ).toThrow(/series\[0\].*Broken.*expected 2, got 1/);
  });
});
