class MermaidDiagramShell extends HTMLElement {
  private openLinkElement: HTMLAnchorElement | null = null;
  private themeObserver: MutationObserver | null = null;
  private popoverElement: HTMLElement | null = null;

  private handleBeforeToggle = (event: Event) => {
    const newState = (event as unknown as { newState?: string }).newState;
    if (newState === "open") this.populatePopover();
  };

  connectedCallback() {
    this.openLinkElement = this.querySelector("[data-diagram-open-link]");

    this.updateOpenLinkTheme();
    this.themeObserver = new MutationObserver(() => {
      this.updateOpenLinkTheme();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    this.popoverElement = this.querySelector("[popover]");
    this.popoverElement?.addEventListener(
      "beforetoggle",
      this.handleBeforeToggle,
    );
  }

  disconnectedCallback() {
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    this.popoverElement?.removeEventListener(
      "beforetoggle",
      this.handleBeforeToggle,
    );
    this.popoverElement = null;
  }

  /**
   * Clones the reading-view diagram figure into the popover the first time it
   * opens. Only one SVG ships in the HTML; the popover copy is created on demand.
   * SVG ids are namespaced in the clone so its markers, clip-paths and scoped
   * CSS don't collide with the original (both live in the same document).
   */
  private populatePopover() {
    const target = this.querySelector<HTMLElement>(
      "[data-diagram-popover-content]",
    );
    if (!target || target.childElementCount > 0) return;

    const source = this.querySelector<HTMLElement>(
      ".mermaid-diagram-container:not([data-diagram-popover-content]) .mermaid-diagram-image",
    );
    if (!source) return;

    const figure = source.cloneNode(true) as HTMLElement;
    const svg = figure.querySelector("svg");
    const rootId = svg?.id;
    if (svg && rootId) {
      figure.innerHTML = svg.outerHTML.split(rootId).join(`${rootId}-x`);
    }
    target.appendChild(figure);
  }

  private updateOpenLinkTheme() {
    if (!this.openLinkElement) return;

    const lightSrc = this.openLinkElement.dataset.diagramLightSrc;
    const darkSrc = this.openLinkElement.dataset.diagramDarkSrc;
    const theme = document.documentElement.getAttribute("data-theme");

    this.openLinkElement.href =
      theme === "dark" && darkSrc ? darkSrc : (lightSrc ?? "#");
  }
}

if (!customElements.get("mermaid-diagram-shell")) {
  customElements.define("mermaid-diagram-shell", MermaidDiagramShell);
}
