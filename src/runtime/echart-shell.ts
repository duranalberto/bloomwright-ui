import type { EnhancedChartHandle } from "../echarts/client.ts";

type ChartEnhancement = "none" | "load" | "idle" | "visible" | "media";

class EChartShell extends HTMLElement {
  private chartHandle: EnhancedChartHandle | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private mediaQuery: MediaQueryList | null = null;
  private mediaQueryListener: ((event: MediaQueryListEvent) => void) | null =
    null;
  private idleHandle: number | ReturnType<typeof setTimeout> | null = null;
  private started = false;

  connectedCallback() {
    this.scheduleEnhancement();
  }

  disconnectedCallback() {
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;

    if (this.mediaQuery && this.mediaQueryListener) {
      this.mediaQuery.removeEventListener("change", this.mediaQueryListener);
      this.mediaQuery = null;
      this.mediaQueryListener = null;
    }

    if (this.idleHandle !== null) {
      if ("cancelIdleCallback" in window) {
        window.cancelIdleCallback(this.idleHandle as number);
      } else {
        clearTimeout(this.idleHandle);
      }
      this.idleHandle = null;
    }

    this.chartHandle?.dispose();
    this.chartHandle = null;
  }

  private scheduleEnhancement() {
    const enhancement = this.getEnhancementMode();
    if (enhancement === "none" || this.started) return;

    if (enhancement === "load") {
      queueMicrotask(() => void this.enhance());
      return;
    }

    if (enhancement === "idle") {
      this.requestIdleEnhancement();
      return;
    }

    if (enhancement === "media") {
      this.requestMediaEnhancement();
      return;
    }

    if ("IntersectionObserver" in window) {
      this.visibilityObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            this.visibilityObserver?.disconnect();
            this.visibilityObserver = null;
            void this.enhance();
          }
        },
        { rootMargin: "200px" },
      );
      this.visibilityObserver.observe(this);
      return;
    }

    this.requestIdleEnhancement();
  }

  private requestIdleEnhancement() {
    if ("requestIdleCallback" in window) {
      this.idleHandle = window.requestIdleCallback(() => {
        this.idleHandle = null;
        void this.enhance();
      });
      return;
    }

    this.idleHandle = setTimeout(() => {
      this.idleHandle = null;
      void this.enhance();
    }, 1);
  }

  private requestMediaEnhancement() {
    const query = this.dataset.chartMedia;
    if (!query || !("matchMedia" in window)) {
      return;
    }

    this.mediaQuery = window.matchMedia(query);

    if (this.mediaQuery.matches) {
      queueMicrotask(() => void this.enhance());
      return;
    }

    this.mediaQueryListener = (event) => {
      if (!event.matches) return;

      if (this.mediaQuery && this.mediaQueryListener) {
        this.mediaQuery.removeEventListener("change", this.mediaQueryListener);
      }
      this.mediaQuery = null;
      this.mediaQueryListener = null;
      void this.enhance();
    };

    this.mediaQuery.addEventListener("change", this.mediaQueryListener);
  }

  private getEnhancementMode(): ChartEnhancement {
    const value = this.dataset.chartHydrate ?? this.dataset.chartEnhance;
    if (
      value === "load" ||
      value === "idle" ||
      value === "visible" ||
      value === "media"
    ) {
      return value;
    }
    return "none";
  }

  private async enhance() {
    if (this.started || !this.isConnected) return;
    this.started = true;
    this.dataset.enhanced = "loading";

    try {
      const surface = this.querySelector<HTMLElement>("[data-echart-surface]");
      const rawOption = this.dataset.chartOption;
      const rawTheme = this.dataset.chartTheme;
      const optionClientPreset = this.dataset.chartOptionClientPreset;
      const width = Number(this.dataset.chartWidth);
      const height = Number(this.dataset.chartHeight);

      if (!surface || !rawOption) {
        throw new Error("Missing chart surface or serialized option.");
      }
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error("Invalid chart dimensions.");
      }

      const option = JSON.parse(rawOption);
      const theme = rawTheme ? JSON.parse(rawTheme) : undefined;
      const { enhanceEChart } = await import("../echarts/client.ts");

      if (!this.isConnected) return;

      this.chartHandle = await enhanceEChart({
        surface,
        option,
        width,
        height,
        theme,
        optionClientPreset:
          optionClientPreset === "currency" ||
          optionClientPreset === "percent" ||
          optionClientPreset === "financeOhlc"
            ? optionClientPreset
            : undefined,
      });
      this.dataset.enhanced = "true";
    } catch (error) {
      this.dataset.enhanced = "failed";
      this.started = false;
      console.error("[echarts] Failed to enhance chart.", error);
    }
  }
}

if (!customElements.get("echart-shell")) {
  customElements.define("echart-shell", EChartShell);
}
