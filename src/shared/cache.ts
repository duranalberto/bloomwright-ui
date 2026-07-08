/**
 * cache.ts — the caller-owned cache & storage port (SPEC §4.7 / FR-CACHE).
 *
 * bloomwright-mdx owns the cache *addressing & coherence* scheme (namespace +
 * version + content-addressed key); the consuming application owns *where and how
 * the bytes are stored, shared, and retained*. That inversion is expressed by the
 * `DiagramCacheStore` port: the integration writes prepared diagrams through it in
 * `astro:build:start`, and the render bridge reads them back through it during
 * component prerendering (a separate module instance) — so a caller-supplied store
 * is the only shared state across that boundary.
 *
 * Two logical namespaces, two lifetimes:
 *   - durable SVG cache   → persists across builds (unchanged diagrams skip render)
 *   - ephemeral manifest  → cleared each build (holds every prepared diagram,
 *                           including failure placeholders)
 *
 * The store is a *dumb* key/value backend: it never interprets values and never
 * derives keys. Version invalidation of the durable cache is realized by the
 * pipeline building version into the key via `buildCacheKey` (below); the ephemeral
 * manifest is invalidated by `clear()` at build start.
 */
import crypto from "node:crypto";
import fsSync from "node:fs";
import fsAsync from "node:fs/promises";
import path from "node:path";

/**
 * Content-addressed key/value store bound to one `namespace` + `version`. A dumb
 * backend: it persists and returns opaque `T` values and never interprets them.
 * The caller may back it with disk, a shared/remote cache, a CI artifact store, …
 */
export interface DiagramCacheStore<T> {
  /** Storage bucket name (e.g. "mermaid-cache"). */
  readonly namespace: string;
  /** Coherence seed; mixed into cache keys via `buildCacheKey`. */
  readonly version: string;

  get(key: string): Promise<T | null>;
  getSync(key: string): T | null;
  set(key: string, value: T): Promise<void>;
  /** Wipe + recreate the bucket — used to reset the ephemeral manifest each build. */
  clear(): Promise<void>;
  /** Every value currently in the bucket (used to emit assets / summarize). */
  readAllSync(): T[];
  ensureDir(): Promise<void>;
}

/**
 * How the caller hands ownership of storage to the integration. Because the
 * Mermaid path needs two distinct namespaces (durable + ephemeral), the option is
 * a *factory* the integration calls once per namespace — not a single bound store.
 */
export type CacheStoreFactory = <T>(
  namespace: string,
  version: string,
) => DiagramCacheStore<T>;

/** Default namespaces used by the built-in disk adapter (all relocatable). */
export const MERMAID_CACHE_NAMESPACE = "mermaid-cache"; // durable SVG cache
export const MERMAID_MANIFEST_NAMESPACE = "mermaid-manifest"; // per-build manifest
export const ECHARTS_CACHE_NAMESPACE = "echarts-cache"; // durable chart cache

/**
 * Derive a versioned, content-addressed key. Bumping `version` (or passing a new
 * `configHash`) changes the key, so the durable cache misses and re-renders — this
 * is how `RENDERER_VERSION` invalidates the SVG cache without a directory wipe.
 */
export function buildCacheKey(
  version: string,
  content: string,
  configHash = "",
): string {
  return crypto
    .createHash("sha256")
    .update(`${version}::${configHash}::${content}`)
    .digest("hex");
}

/** Stable short hash of a config object, for mixing into `buildCacheKey`. */
export function hashConfig(config: Record<string, unknown>): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(config))
    .digest("hex")
    .slice(0, 16);
}

/** Truncated key for readable build logs. */
export function shortKey(key: string): string {
  return `${key.slice(0, 12)}…`;
}

class DiskCacheStore<T> implements DiagramCacheStore<T> {
  readonly namespace: string;
  readonly version: string;
  private readonly cacheDir: string;

  constructor(namespace: string, version: string, baseDir: string) {
    this.namespace = namespace;
    this.version = version;
    this.cacheDir = path.join(baseDir, namespace);
  }

  private getPath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  async ensureDir(): Promise<void> {
    await fsAsync.mkdir(this.cacheDir, { recursive: true });
  }

  private ensureDirSync(): void {
    if (!fsSync.existsSync(this.cacheDir)) {
      fsSync.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async clear(): Promise<void> {
    await fsAsync.rm(this.cacheDir, { recursive: true, force: true });
    await this.ensureDir();
  }

  async get(key: string): Promise<T | null> {
    try {
      const raw = await fsAsync.readFile(this.getPath(key), "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  getSync(key: string): T | null {
    try {
      const raw = fsSync.readFileSync(this.getPath(key), "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: T): Promise<void> {
    await this.ensureDir();
    const finalPath = this.getPath(key);
    const tempPath = `${finalPath}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    try {
      await fsAsync.writeFile(tempPath, JSON.stringify(value), "utf-8");
      await fsAsync.rename(tempPath, finalPath);
    } catch (err) {
      await fsAsync.unlink(tempPath).catch(() => {});
      throw err;
    }
  }

  readAllSync(): T[] {
    this.ensureDirSync();
    const values: T[] = [];
    for (const file of fsSync.readdirSync(this.cacheDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = fsSync.readFileSync(path.join(this.cacheDir, file), "utf-8");
        values.push(JSON.parse(raw) as T);
      } catch {
        // Skip corrupt/partial entries.
      }
    }
    return values;
  }
}

/**
 * Zero-config default: a disk-backed `DiagramCacheStore` under `<baseDir>/<namespace>`
 * (`baseDir` defaults to the project's `.astro/`). Consumers who want to own storage
 * (relocate, share across CI, persist longer) pass their own factory as `options.cache`.
 */
export function createDiskCacheStore<T>(
  namespace: string,
  version = "v1",
  baseDir: string = path.join(process.cwd(), ".astro"),
): DiagramCacheStore<T> {
  return new DiskCacheStore<T>(namespace, version, baseDir);
}
