import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCacheKey,
  createDiskCacheStore,
  hashConfig,
  MERMAID_CACHE_NAMESPACE,
  MERMAID_MANIFEST_NAMESPACE,
  type DiagramCacheStore,
} from "../../src/shared/cache.ts";

interface Entry {
  href: string;
  n: number;
}

let baseDir: string;

beforeAll(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "bmx-cache-"));
});

afterAll(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("DiagramCacheStore — disk adapter (BMX-002)", () => {
  it("round-trips values via set/get/getSync", async () => {
    const store = createDiskCacheStore<Entry>(
      MERMAID_CACHE_NAMESPACE,
      "v1",
      baseDir,
    );
    expect(store.namespace).toBe("mermaid-cache");
    expect(store.getSync("missing")).toBeNull();
    expect(await store.get("missing")).toBeNull();

    await store.set("abc123", { href: "/x.svg", n: 1 });
    expect(await store.get("abc123")).toEqual({ href: "/x.svg", n: 1 });
    expect(store.getSync("abc123")).toEqual({ href: "/x.svg", n: 1 });
  });

  it("readAllSync returns every stored value", async () => {
    const store = createDiskCacheStore<Entry>("readall-ns", "v1", baseDir);
    await store.set("a", { href: "/a", n: 1 });
    await store.set("b", { href: "/b", n: 2 });
    const all = store.readAllSync().sort((x, y) => x.n - y.n);
    expect(all).toEqual([
      { href: "/a", n: 1 },
      { href: "/b", n: 2 },
    ]);
  });

  it("clear() wipes and recreates (ephemeral manifest lifetime)", async () => {
    const store = createDiskCacheStore<Entry>(
      MERMAID_MANIFEST_NAMESPACE,
      "v1",
      baseDir,
    );
    await store.set("k", { href: "/k", n: 1 });
    expect(store.getSync("k")).not.toBeNull();
    await store.clear();
    expect(store.getSync("k")).toBeNull();
    expect(store.readAllSync()).toEqual([]);
  });

  it("durable namespace survives while ephemeral is cleared (two builds)", async () => {
    const durable = createDiskCacheStore<Entry>("durable-ns", "v1", baseDir);
    const ephemeral = createDiskCacheStore<Entry>("ephemeral-ns", "v1", baseDir);

    // build 1
    await durable.set("d", { href: "/d", n: 1 });
    await ephemeral.set("e", { href: "/e", n: 1 });

    // build 2 start: manifest cleared, durable untouched
    await ephemeral.clear();
    expect(durable.getSync("d")).toEqual({ href: "/d", n: 1 });
    expect(ephemeral.getSync("e")).toBeNull();
  });
});

describe("cache key derivation (BMX-002)", () => {
  it("buildCacheKey is stable and version-sensitive", () => {
    const a = buildCacheKey("v1", "graph TD; A-->B");
    const b = buildCacheKey("v1", "graph TD; A-->B");
    const c = buildCacheKey("v2", "graph TD; A-->B");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("hashConfig is stable for identical config", () => {
    expect(hashConfig({ a: 1, b: 2 })).toBe(hashConfig({ a: 1, b: 2 }));
  });
});

describe("cache port — caller-supplied store (BMX-002)", () => {
  it("accepts a custom in-memory DiagramCacheStore", async () => {
    const mem = new Map<string, Entry>();
    const store: DiagramCacheStore<Entry> = {
      namespace: "mem",
      version: "v1",
      get: async (k) => mem.get(k) ?? null,
      getSync: (k) => mem.get(k) ?? null,
      set: async (k, v) => void mem.set(k, v),
      clear: async () => void mem.clear(),
      readAllSync: () => [...mem.values()],
      ensureDir: async () => {},
    };

    await store.set("z", { href: "/z", n: 9 });
    expect(store.getSync("z")).toEqual({ href: "/z", n: 9 });
    expect(store.readAllSync()).toHaveLength(1);
  });
});
