interface HlsLevel {
  width: number;
  height: number;
}

interface HlsInstance {
  currentLevel: number;
  attachMedia(video: HTMLVideoElement): void;
  loadSource(url: string): void;
  destroy(): void;
  recoverMediaError(): void;
  on(event: string, callback: (event: string, data: unknown) => void): void;
}

interface HlsStatic {
  isSupported(): boolean;
  Events: {
    MEDIA_ATTACHED: string;
    MANIFEST_PARSED: string;
    ERROR: string;
  };
  ErrorTypes: {
    MEDIA_ERROR: string;
    NETWORK_ERROR: string;
  };
  new (config?: Record<string, unknown>): HlsInstance;
}

declare global {
  interface Window {
    Hls?: HlsStatic;
  }
}

// Catalog metadata (title/description/tags) is only published alongside
// videos served from this CloudFront distribution's catalog.json.
const CATALOG_METADATA_HOST = "d2mcml34hdlt3o.cloudfront.net";

interface CatalogVideoEntry {
  title?: string;
  description?: string;
  tags?: string[];
  playbackUrl?: string;
}

function isManifestParsedData(
  value: unknown,
): value is { levels: HlsLevel[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { levels?: unknown }).levels)
  );
}

function isErrorData(value: unknown): value is { fatal: boolean; type: string } {
  return typeof value === "object" && value !== null && "fatal" in value;
}

function isCatalogVideoEntry(value: unknown): value is CatalogVideoEntry {
  return typeof value === "object" && value !== null;
}

class VideoPlayerShell extends HTMLElement {
  private hls: HlsInstance | null = null;
  private mediaRecoveryAttempted = false;

  connectedCallback() {
    const video = this.querySelector<HTMLVideoElement>(
      "[data-video-player-el]",
    );
    const qualityControl = this.querySelector<HTMLElement>(
      "[data-video-quality-control]",
    );
    const qualitySelect = this.querySelector<HTMLSelectElement>(
      "[data-video-player-quality]",
    );
    const src = this.dataset.videoSrc;

    if (!video || !qualityControl || !qualitySelect || !src) return;

    qualitySelect.addEventListener("change", () => {
      if (!this.hls) return;
      this.hls.currentLevel = Number(qualitySelect.value);
    });

    this.load(video, qualityControl, qualitySelect, src);
    void this.loadMetadata(src);
  }

  disconnectedCallback() {
    this.hls?.destroy();
    this.hls = null;
  }

  private populateQualityLevels(
    select: HTMLSelectElement,
    levels: HlsLevel[],
  ) {
    select.innerHTML = '<option value="-1">Auto</option>';

    levels.forEach((level, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${level.width}×${level.height}`;
      select.append(option);
    });

    select.disabled = false;
  }

  private load(
    video: HTMLVideoElement,
    qualityControl: HTMLElement,
    qualitySelect: HTMLSelectElement,
    src: string,
  ) {
    const Hls = window.Hls;

    if (Hls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, startLevel: -1 });
      this.hls = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (!isManifestParsedData(data)) return;
        this.populateQualityLevels(qualitySelect, data.levels);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!isErrorData(data) || !data.fatal) return;

        if (
          data.type === Hls.ErrorTypes.MEDIA_ERROR &&
          !this.mediaRecoveryAttempted
        ) {
          this.mediaRecoveryAttempted = true;
          hls.recoverMediaError();
          return;
        }

        hls.destroy();
        this.hls = null;
        qualityControl.hidden = true;
      });

      hls.attachMedia(video);
      return;
    }

    // Browsers without MSE support (e.g. Safari) play HLS natively and don't
    // expose per-rendition switching, so a manual quality control here would
    // stay disabled forever. Hide it instead of showing a dead control.
    qualityControl.hidden = true;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }
  }

  private async loadMetadata(src: string) {
    const metadata = this.querySelector<HTMLElement>("[data-video-metadata]");
    const titleEl = this.querySelector<HTMLElement>(
      "[data-video-metadata-title]",
    );
    const descriptionEl = this.querySelector<HTMLElement>(
      "[data-video-metadata-description]",
    );
    const tagsEl = this.querySelector<HTMLElement>(
      "[data-video-metadata-tags]",
    );

    if (!metadata || !titleEl || !descriptionEl || !tagsEl) return;

    let hostname: string;
    try {
      hostname = new URL(src).hostname;
    } catch {
      return;
    }

    if (hostname !== CATALOG_METADATA_HOST) return;

    try {
      const response = await fetch(
        `https://${CATALOG_METADATA_HOST}/catalog/catalog.json`,
        { mode: "cors" },
      );
      if (!response.ok) return;

      const catalog: unknown = await response.json();
      const videos =
        typeof catalog === "object" &&
        catalog !== null &&
        Array.isArray((catalog as { videos?: unknown }).videos)
          ? (catalog as { videos: unknown[] }).videos
          : [];

      const entry = videos.find(
        (candidate): candidate is CatalogVideoEntry =>
          isCatalogVideoEntry(candidate) && candidate.playbackUrl === src,
      );
      if (!entry) return;

      let hasContent = false;

      if (entry.title) {
        titleEl.textContent = entry.title;
        titleEl.hidden = false;
        hasContent = true;
      }

      if (entry.description) {
        descriptionEl.textContent = entry.description;
        descriptionEl.hidden = false;
        hasContent = true;
      }

      if (Array.isArray(entry.tags) && entry.tags.length > 0) {
        tagsEl.innerHTML = "";
        entry.tags.forEach((tag) => {
          const span = document.createElement("span");
          span.textContent = `#${tag}`;
          tagsEl.append(span);
        });
        tagsEl.hidden = false;
        hasContent = true;
      }

      metadata.hidden = !hasContent;
    } catch {
      // Metadata is a nice-to-have; playback works fine without it.
    }
  }
}

if (!customElements.get("video-player-shell")) {
  customElements.define("video-player-shell", VideoPlayerShell);
}

export {};
