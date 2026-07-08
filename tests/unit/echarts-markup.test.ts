import { afterEach, describe, expect, it } from "vitest";
import {
  resetEChartArtifacts,
  setEChartArtifactBuildMode,
} from "../../src/echarts/artifacts";
import { renderEChartMarkup } from "../../src/echarts/markup";
import { lineChartOption } from "../../src/echarts/options";

afterEach(() => {
  setEChartArtifactBuildMode(false);
  resetEChartArtifacts();
});

describe("ECharts shared markup renderer", () => {
  it("renders inline SVG shell HTML with caption and ARIA labels", () => {
    const option = lineChartOption({ x: ["A"], y: [1], name: "Revenue" });
    const rendered = renderEChartMarkup({
      option,
      title: "Revenue <Chart>",
      caption: "Trailing twelve months",
      description: "Revenue chart",
      width: 480,
      height: 280,
      className: "custom-chart",
    });

    expect(rendered.html).toContain("<echart-shell");
    expect(rendered.html).toContain("echart-wrapper not-prose custom-chart");
    expect(rendered.html).toContain("Revenue &lt;Chart&gt;");
    expect(rendered.html).toContain('aria-label="Revenue chart"');
    expect(rendered.html).toContain("<svg");
    expect(rendered.html).not.toContain("data-chart-option=");
  });

  it("renders SVG file shell markup in build mode", () => {
    setEChartArtifactBuildMode(true);
    const rendered = renderEChartMarkup({
      option: lineChartOption({ x: ["A"], y: [1] }),
      render: "svg-file",
      description: "File chart",
      width: 320,
      height: 180,
    });

    expect(rendered.html).toContain('class="echart-static-image"');
    expect(rendered.html).toContain('src="/_app/charts/');
    expect(rendered.html).not.toContain("<svg");
  });

  it("serializes client chart data only when hydration is enabled", () => {
    const option = lineChartOption({ x: ["A"], y: [1] });
    const staticMarkup = renderEChartMarkup({
      option,
      description: "Static",
    });
    const hydratedMarkup = renderEChartMarkup({
      option,
      description: "Hydrated",
      hydrate: "visible",
      optionClientPreset: "currency",
    });

    expect(staticMarkup.html).not.toContain("data-chart-option=");
    expect(hydratedMarkup.shouldEnhance).toBe(true);
    expect(hydratedMarkup.html).toContain('data-chart-hydrate="visible"');
    expect(hydratedMarkup.html).toContain("data-chart-option=");
    expect(hydratedMarkup.html).toContain(
      'data-chart-option-client-preset="currency"',
    );
    expect(hydratedMarkup.html).toContain('data-enhanced="false"');
  });

  it("generates stable IDs for equivalent inputs", () => {
    const option = lineChartOption({ x: ["A"], y: [1] });
    const first = renderEChartMarkup({ option, description: "Stable" });
    const second = renderEChartMarkup({ option, description: "Stable" });

    expect(first.chartId).toBe(second.chartId);
  });
});
