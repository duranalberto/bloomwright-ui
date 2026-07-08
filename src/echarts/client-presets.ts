import type { ChartOption } from "./registry.ts";

export type ChartClientPreset = "currency" | "percent" | "financeOhlc";

type MutableChartOption = ChartOption & Record<string, unknown>;

function formatNumber(
  value: unknown,
  options: Intl.NumberFormatOptions,
): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return new Intl.NumberFormat("en-US", options).format(number);
}

function ensureObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function setValueFormatter(
  option: MutableChartOption,
  formatter: (value: unknown) => string,
): void {
  option.tooltip = {
    ...ensureObject(option.tooltip),
    valueFormatter: formatter,
  };

  const yAxis = option.yAxis;
  const label = { formatter };

  if (Array.isArray(yAxis)) {
    option.yAxis = yAxis.map((axis) => ({
      ...ensureObject(axis),
      axisLabel: {
        ...ensureObject(ensureObject(axis).axisLabel),
        ...label,
      },
    }));
    return;
  }

  option.yAxis = {
    ...ensureObject(yAxis),
    axisLabel: {
      ...ensureObject(ensureObject(yAxis).axisLabel),
      ...label,
    },
  };
}

function applyFinanceTooltip(option: MutableChartOption): void {
  option.tooltip = {
    ...ensureObject(option.tooltip),
    formatter(params: unknown) {
      const items = Array.isArray(params) ? params : [params];
      const rows = items.map((item) => {
        const record = ensureObject(item);
        const marker = String(record.marker ?? "");
        const name = String(record.seriesName ?? "");
        const value = Array.isArray(record.value)
          ? record.value
              .map((part) =>
                typeof part === "number"
                  ? formatNumber(part, {
                      maximumFractionDigits: 2,
                    })
                  : String(part),
              )
              .join(" / ")
          : formatNumber(record.value, {
              maximumFractionDigits: 2,
            });

        return `${marker}${name}: ${value}`;
      });

      return rows.join("<br/>");
    },
  };
}

export function applyClientOptionPreset(
  option: ChartOption,
  preset?: ChartClientPreset,
): ChartOption {
  if (!preset) return option;

  const next = option as MutableChartOption;

  if (preset === "currency") {
    setValueFormatter(next, (value) =>
      formatNumber(value, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }),
    );
    return next;
  }

  if (preset === "percent") {
    setValueFormatter(next, (value) =>
      formatNumber(Number(value) / 100, {
        style: "percent",
        maximumFractionDigits: 1,
      }),
    );
    return next;
  }

  if (preset === "financeOhlc") {
    applyFinanceTooltip(next);
    return next;
  }

  throw new Error(`Unknown EChart client option preset "${preset}".`);
}
