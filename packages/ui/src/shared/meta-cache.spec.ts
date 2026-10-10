import { AsyncLocalStorage } from "node:async_hooks";
import { Client, MetaStore } from "@atscript/db-client";
import { serializeAnnotatedType } from "@atscript/typescript/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetDefaultClientFactory,
  setDefaultClientFactory,
  type ClientFactory,
} from "../client-factory";
import { resolveValueHelp } from "../value-help/resolve";
import {
  getMetaCacheIdentity,
  getMetaEntry,
  getMetaTableDef,
  onMetaCacheReset,
  resetMetaCache,
  retainMetaEntry,
  setMetaCacheIdentity,
  setMetaCacheMaxEntries,
} from "./meta-cache";

async function buildSerialized() {
  const { Author } = await import("../__tests__/fixtures/value-help-target.as");
  return serializeAnnotatedType(Author);
}

function buildMetaResponse(serialized: unknown) {
  return {
    searchable: true,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: ["id"],
    preferredId: ["id"],
    crud: { query: [], pages: [], one: [] },
    actions: [],
    relations: [],
    fields: {
      id: { sortable: true, filterable: true },
      name: { sortable: true, filterable: true },
    },
    type: serialized,
  };
}

function makeFactory(metaImpl: () => Promise<unknown>): {
  factory: ClientFactory;
  metaSpy: ReturnType<typeof vi.fn>;
} {
  const metaSpy = vi.fn(metaImpl);
  const factory: ClientFactory = () =>
    ({
      meta: metaSpy,
      invalidateMeta: vi.fn(),
    }) as unknown as Client;
  return { factory, metaSpy };
}

/** One shared client per URL that memoizes `/meta` like `@atscript/db-client`'s `Client`. */
function makeMemoClient(metaImpl: () => Promise<unknown>) {
  const fetchMeta = vi.fn(metaImpl);
  let memo: Promise<unknown> | undefined;
  const client = {
    meta: () => (memo ??= fetchMeta()),
    invalidateMeta: vi.fn(() => {
      memo = undefined;
    }),
  };
  return { client, fetchMeta, factory: (() => client) as unknown as ClientFactory };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// The cache lives only in the browser — `packages/ui` tests run in node.
beforeEach(() => {
  vi.stubGlobal("window", {});
});

afterEach(() => {
  setMetaCacheMaxEntries();
  resetMetaCache();
  resetDefaultClientFactory();
  vi.unstubAllGlobals();
});

describe("meta-cache", () => {
  it("returns the same entry for repeated calls on one URL", async () => {
    const serialized = await buildSerialized();
    const { factory } = makeFactory(async () => buildMetaResponse(serialized));
    setDefaultClientFactory(factory);

    const a = getMetaEntry("/authors");
    const b = getMetaEntry("/authors");

    expect(a).toBe(b);
    expect(a.client).toBe(b.client);
  });

  it("resolveValueHelp + getMetaEntry share a single /meta fetch", async () => {
    const serialized = await buildSerialized();
    const { factory, metaSpy } = makeFactory(async () => buildMetaResponse(serialized));
    setDefaultClientFactory(factory);

    const resolved = await resolveValueHelp("/authors");
    const entry = getMetaEntry("/authors");
    const sharedType = await entry.type;

    expect(metaSpy).toHaveBeenCalledTimes(1);
    expect(resolved.targetType).toBe(sharedType);
  });

  it("resetMetaCache evicts both derived shapes", async () => {
    const serialized = await buildSerialized();
    const { factory, metaSpy } = makeFactory(async () => buildMetaResponse(serialized));
    setDefaultClientFactory(factory);

    await resolveValueHelp("/authors");
    expect(metaSpy).toHaveBeenCalledTimes(1);

    resetMetaCache();
    await resolveValueHelp("/authors");
    expect(metaSpy).toHaveBeenCalledTimes(2);
  });

  it("rejected meta evicts the entry", async () => {
    const serialized = await buildSerialized();
    let callCount = 0;
    const { factory, metaSpy } = makeFactory(async () => {
      callCount++;
      if (callCount === 1) throw new Error("network");
      return buildMetaResponse(serialized);
    });
    setDefaultClientFactory(factory);

    await expect(resolveValueHelp("/authors")).rejects.toThrow("network");
    const retried = await resolveValueHelp("/authors");

    expect(metaSpy).toHaveBeenCalledTimes(2);
    expect(retried.labelField).toBe("name");
  });

  it("resetMetaCache drops the /meta each cached client memoizes", async () => {
    const serialized = await buildSerialized();
    const { client, fetchMeta, factory } = makeMemoClient(async () =>
      buildMetaResponse(serialized),
    );

    await getMetaEntry("/authors", factory).meta;
    resetMetaCache();
    expect(client.invalidateMeta).toHaveBeenCalledTimes(1);

    await getMetaEntry("/authors", factory).meta;
    expect(fetchMeta).toHaveBeenCalledTimes(2);
  });

  it("setMetaCacheIdentity resets on a new identity and keeps the cache for the same one", async () => {
    const serialized = await buildSerialized();
    const { client, fetchMeta, factory } = makeMemoClient(async () =>
      buildMetaResponse(serialized),
    );
    setMetaCacheIdentity("1:admin");
    client.invalidateMeta.mockClear();

    const first = getMetaEntry("/authors", factory);
    setMetaCacheIdentity("1:admin");
    expect(getMetaEntry("/authors", factory)).toBe(first);
    expect(client.invalidateMeta).not.toHaveBeenCalled();

    setMetaCacheIdentity(null);
    expect(client.invalidateMeta).toHaveBeenCalledTimes(1);
    setMetaCacheIdentity(undefined); // still anonymous
    const second = getMetaEntry("/authors", factory);
    expect(second).not.toBe(first);

    setMetaCacheIdentity("2:viewer");
    expect(getMetaEntry("/authors", factory)).not.toBe(second);
    expect(client.invalidateMeta).toHaveBeenCalledTimes(2);
    expect(fetchMeta).toHaveBeenCalledTimes(3); // once per identity
  });

  it("a /meta request in flight across a reset never touches the new entry", async () => {
    const serialized = await buildSerialized();
    const stale = deferred<unknown>();
    const fresh = deferred<unknown>();
    const responses = [stale.promise, fresh.promise];
    const { factory } = makeFactory(() => responses.shift()!);

    const before = getMetaEntry("/authors", factory);
    before.type.catch(() => {});
    resetMetaCache();
    const after = getMetaEntry("/authors", factory);
    expect(after).not.toBe(before);

    stale.reject(new Error("aborted"));
    await expect(before.meta).rejects.toThrow("aborted");
    expect(getMetaEntry("/authors", factory)).toBe(after);

    fresh.resolve(buildMetaResponse(serialized));
    await after.meta;
    expect(getMetaEntry("/authors", factory)).toBe(after);
  });

  it("caches nothing without a browser window", async () => {
    vi.unstubAllGlobals();
    const serialized = await buildSerialized();
    const { client, fetchMeta, factory } = makeMemoClient(async () =>
      buildMetaResponse(serialized),
    );

    const a = getMetaEntry("/authors", factory);
    const b = getMetaEntry("/authors", factory);
    expect(a).not.toBe(b);
    resetMetaCache();
    expect(client.invalidateMeta).not.toHaveBeenCalled();
    await Promise.all([a.meta, b.meta]);
    expect(fetchMeta).toHaveBeenCalledTimes(1); // the shared client's own memo
  });

  it("two server renders for different viewers each get their own /meta", async () => {
    vi.unstubAllGlobals();
    const serialized = await buildSerialized();
    // Stands in for SSR self-fetch: the request carries the viewer whose
    // render issued it (moost forwards it through async context).
    const viewer = new AsyncLocalStorage<string>();
    const fetchMeta = vi.fn(async () => {
      const meta = buildMetaResponse(serialized);
      if (viewer.getStore() === "viewer") delete (meta.fields as Record<string, unknown>).name;
      return new Response(JSON.stringify(meta), {
        headers: { "content-type": "application/json" },
      });
    });
    setDefaultClientFactory((url) => new Client(url, { fetch: fetchMeta }));

    const render = (who: string) =>
      viewer.run(who, async () => {
        const entry = getMetaEntry("/authors");
        await entry.type;
        return Object.keys((await entry.meta).fields);
      });
    const [admin, view] = await Promise.all([render("admin"), render("viewer")]);
    const adminAgain = await render("admin");

    expect(admin).toEqual(["id", "name"]);
    expect(view).toEqual(["id"]);
    expect(adminAgain).toEqual(["id", "name"]);
    expect(fetchMeta).toHaveBeenCalledTimes(3);
  });

  describe("parametric mounts (metaKey + ETag)", () => {
    /**
     * A server serving byte-identical `/meta` under every `/tickets/:key`
     * with a weak ETag, answering a matching `If-None-Match` with a `304`.
     */
    async function fakeServer() {
      const body = JSON.stringify(buildMetaResponse(await buildSerialized()));
      const etag = 'W/"meta-v1"';
      const calls: { url: string; ifNoneMatch?: string; status: number }[] = [];
      const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : input.toString();
        const headers = (init?.headers ?? {}) as Record<string, string>;
        const ifNoneMatch = headers["If-None-Match"];
        if (ifNoneMatch?.split(/\s*,\s*/).includes(etag)) {
          calls.push({ url, ifNoneMatch, status: 304 });
          return new Response(null, { status: 304, headers: { ETag: etag } });
        }
        calls.push({ url, ifNoneMatch, status: 200 });
        return new Response(body, {
          headers: { "content-type": "application/json", ETag: etag },
        });
      });
      return { fetch, calls };
    }

    it("a new key of the same template costs a 304 and reuses the deserialized type + TableDef", async () => {
      const { fetch, calls } = await fakeServer();
      const factory: ClientFactory = (url, opts) => new Client(url, { ...opts, fetch });
      const metaKey = "/tickets/:key";

      const a = getMetaEntry("/tickets/A", factory, { metaKey });
      const defA = await getMetaTableDef(a);
      const b = getMetaEntry("/tickets/B", factory, { metaKey });
      const defB = await getMetaTableDef(b);

      expect(b).not.toBe(a);
      expect(calls.map((c) => c.status)).toEqual([200, 304]);
      expect(calls[1]).toMatchObject({ url: "/tickets/B/meta", ifNoneMatch: 'W/"meta-v1"' });
      expect(await b.type).toBe(await a.type);
      expect(defB).toBe(defA);
      expect(getMetaTableDef(b)).toBe(getMetaTableDef(b));
    });

    it("without metaKey every URL downloads its own /meta (default per URL)", async () => {
      const { fetch, calls } = await fakeServer();
      const factory: ClientFactory = (url, opts) => new Client(url, { ...opts, fetch });

      await getMetaEntry("/tickets/A", factory).meta;
      await getMetaEntry("/tickets/B", factory).meta;
      expect(calls.map((c) => c.status)).toEqual([200, 200]);
    });

    it("an identity change clears the db-client meta stores (default and custom)", async () => {
      const { fetch, calls } = await fakeServer();
      const custom = new MetaStore();
      const viaDefault: ClientFactory = (url, opts) => new Client(url, { ...opts, fetch });
      const viaCustom: ClientFactory = (url, opts) =>
        new Client(url, { ...opts, fetch, metaStore: custom });
      setMetaCacheIdentity("1:admin");

      await getMetaEntry("/tickets/A", viaDefault, { metaKey: "/tickets/:key" }).meta;
      await getMetaEntry("/orders/A", viaCustom, { metaKey: "/orders/:key" }).meta;
      expect(custom.size).toBe(1);

      setMetaCacheIdentity("2:viewer");
      expect(custom.size).toBe(0);
      await getMetaEntry("/tickets/B", viaDefault, { metaKey: "/tickets/:key" }).meta;
      await getMetaEntry("/orders/B", viaCustom, { metaKey: "/orders/:key" }).meta;
      // No validator survived the switch: both downloaded unconditionally.
      expect(calls.map((c) => [c.status, c.ifNoneMatch])).toEqual([
        [200, undefined],
        [200, undefined],
        [200, undefined],
        [200, undefined],
      ]);
    });

    it("the shared type + TableDef live while a cached URL uses their ETag", async () => {
      const { fetch } = await fakeServer();
      const factory: ClientFactory = (url, opts) => new Client(url, { ...opts, fetch });
      const metaKey = "/tickets/:key";
      setMetaCacheMaxEntries(2);

      const a = getMetaEntry("/tickets/A", factory, { metaKey });
      const defA = await getMetaTableDef(a);
      const b = getMetaEntry("/tickets/B", factory, { metaKey });
      expect(await getMetaTableDef(b)).toBe(defA);

      // A goes; B still uses the ETag, so C shares it.
      const c = getMetaEntry("/tickets/C", factory, { metaKey });
      expect(await getMetaTableDef(c)).toBe(defA);

      // D + E push out B and C: nothing cached references the ETag any more.
      const d = getMetaEntry("/tickets/D", factory, { metaKey });
      const defD = await getMetaTableDef(d);
      expect(defD).toBe(defA); // C was still cached when D loaded
      getMetaEntry("/orders/A", factory);
      getMetaEntry("/orders/B", factory);
      const e = getMetaEntry("/tickets/E", factory, { metaKey });
      const defE = await getMetaTableDef(e);
      expect(defE).not.toBe(defA);
      expect(await e.type).not.toBe(await a.type);
      // Entries handed out earlier keep what they had.
      expect(await getMetaTableDef(a)).toBe(defA);
    });

    it("a custom meta store is cleared once no cached client uses it", async () => {
      const { fetch } = await fakeServer();
      const custom = new MetaStore();
      const viaCustom: ClientFactory = (url, opts) =>
        new Client(url, { ...opts, fetch, metaStore: custom });
      const viaDefault: ClientFactory = (url, opts) => new Client(url, { ...opts, fetch });
      setMetaCacheMaxEntries(1);

      await getMetaEntry("/orders/A", viaCustom).meta;
      expect(custom.size).toBe(1);
      await getMetaEntry("/tickets/A", viaDefault).meta;
      expect(custom.size).toBe(0);
    });

    it("server rendering asks the factory for no meta store and shares nothing", async () => {
      vi.unstubAllGlobals();
      const { fetch, calls } = await fakeServer();
      const seen: unknown[] = [];
      const factory: ClientFactory = (url, opts) => {
        seen.push(opts);
        return new Client(url, { ...opts, fetch });
      };

      const a = getMetaEntry("/tickets/A", factory, { metaKey: "/tickets/:key" });
      const b = getMetaEntry("/tickets/B", factory, { metaKey: "/tickets/:key" });
      await Promise.all([a.meta, b.meta]);
      expect(seen).toEqual([{ metaStore: false }, { metaStore: false }]);
      expect(calls.map((c) => [c.status, c.ifNoneMatch])).toEqual([
        [200, undefined],
        [200, undefined],
      ]);
      expect(await b.type).not.toBe(await a.type);
    });
  });

  describe("size limit", () => {
    function urlFactory() {
      const clients = new Map<
        string,
        { meta: ReturnType<typeof vi.fn>; invalidateMeta: ReturnType<typeof vi.fn> }
      >();
      const factory: ClientFactory = (url) => {
        const client = { meta: vi.fn(() => new Promise(() => {})), invalidateMeta: vi.fn() };
        clients.set(url, client);
        return client as unknown as Client;
      };
      return { factory, clients };
    }

    it("evicts the least recently used URL; a hit makes a URL most recent", () => {
      const { factory } = urlFactory();
      setMetaCacheMaxEntries(2);

      const a = getMetaEntry("/a", factory);
      const b = getMetaEntry("/b", factory);
      expect(getMetaEntry("/a", factory)).toBe(a); // hit: /b is now the oldest
      getMetaEntry("/c", factory);

      expect(getMetaEntry("/a", factory)).toBe(a);
      expect(getMetaEntry("/b", factory)).not.toBe(b);
    });

    it("drops the memoized /meta of an evicted client", () => {
      const { factory, clients } = urlFactory();
      setMetaCacheMaxEntries(1);

      getMetaEntry("/a", factory);
      const first = clients.get("/a")!;
      expect(first.invalidateMeta).not.toHaveBeenCalled();
      getMetaEntry("/b", factory);
      expect(first.invalidateMeta).toHaveBeenCalledTimes(1);
      expect(clients.get("/b")!.invalidateMeta).not.toHaveBeenCalled();
    });

    it("never evicts a retained entry; releasing makes it most recent", () => {
      const { factory } = urlFactory();
      setMetaCacheMaxEntries(2);

      const a = getMetaEntry("/a", factory);
      const release = retainMetaEntry(a);
      const b = getMetaEntry("/b", factory);
      getMetaEntry("/c", factory); // /a is the oldest but held: /b goes
      getMetaEntry("/d", factory);
      expect(getMetaEntry("/a", factory)).toBe(a);
      expect(getMetaEntry("/b", factory)).not.toBe(b);

      release();
      release(); // idempotent
      const e = getMetaEntry("/e", factory); // /a was released last: older ones go first
      expect(getMetaEntry("/a", factory)).toBe(a);
      expect(getMetaEntry("/e", factory)).toBe(e);
      getMetaEntry("/f", factory);
      getMetaEntry("/g", factory);
      expect(getMetaEntry("/a", factory)).not.toBe(a);
    });

    it("held entries may exceed the limit; the newest entry always stays", () => {
      const { factory } = urlFactory();
      setMetaCacheMaxEntries(1);

      const a = getMetaEntry("/a", factory);
      const releaseA = retainMetaEntry(a);
      const b = getMetaEntry("/b", factory);
      const releaseB = retainMetaEntry(b);
      expect(getMetaEntry("/a", factory)).toBe(a);
      expect(getMetaEntry("/b", factory)).toBe(b);

      releaseA();
      // Releasing trims back to the limit — /a is the most recent, /b is held.
      expect(getMetaEntry("/b", factory)).toBe(b);
      releaseB();
      expect(getMetaEntry("/b", factory)).toBe(b);
      expect(getMetaEntry("/a", factory)).not.toBe(a);
    });

    it("defaults to 100 URLs; setMetaCacheMaxEntries trims at once, Infinity lifts the limit", () => {
      const { factory } = urlFactory();
      const entries = Array.from({ length: 100 }, (_, i) => getMetaEntry(`/${i}`, factory));
      expect(getMetaEntry("/0", factory)).toBe(entries[0]); // 100 fit; /0 is now the most recent
      getMetaEntry("/100", factory); // pushes out /1
      expect(getMetaEntry("/0", factory)).toBe(entries[0]);
      expect(getMetaEntry("/1", factory)).not.toBe(entries[1]);

      setMetaCacheMaxEntries(Infinity);
      const kept = getMetaEntry("/kept", factory);
      for (let i = 0; i < 300; i++) getMetaEntry(`/x${i}`, factory);
      expect(getMetaEntry("/kept", factory)).toBe(kept);

      const x299 = getMetaEntry("/x299", factory);
      setMetaCacheMaxEntries(2); // keeps /x299 and /kept, the two most recent
      expect(getMetaEntry("/x299", factory)).toBe(x299);
      expect(getMetaEntry("/kept", factory)).toBe(kept);
      expect(getMetaEntry("/x298", factory)).not.toBe(x299);
      expect(getMetaEntry("/x299", factory)).not.toBe(x299); // /x298 + /kept pushed it out

      setMetaCacheMaxEntries(0); // clamped to 1
      const only = getMetaEntry("/only", factory);
      expect(getMetaEntry("/only", factory)).toBe(only);
    });

    it("an identity change still drops retained entries; releasing a dropped one is harmless", () => {
      const { factory, clients } = urlFactory();
      setMetaCacheMaxEntries(1);
      setMetaCacheIdentity("1:admin");

      const a = getMetaEntry("/a", factory);
      const release = retainMetaEntry(a);
      const oldClient = clients.get("/a")!;
      setMetaCacheIdentity("2:viewer");
      expect(oldClient.invalidateMeta).toHaveBeenCalledTimes(1);

      const fresh = getMetaEntry("/a", factory);
      expect(fresh).not.toBe(a);
      release();
      expect(getMetaEntry("/a", factory)).toBe(fresh);
      getMetaEntry("/b", factory);
      expect(getMetaEntry("/a", factory)).not.toBe(fresh);
    });

    it("a rejected /meta still frees its slot", async () => {
      const { factory, metaSpy } = makeFactory(async () => {
        throw new Error("network");
      });
      setMetaCacheMaxEntries(1);

      const a = getMetaEntry("/a", factory);
      a.type.catch(() => {});
      await expect(a.meta).rejects.toThrow("network");
      const b = getMetaEntry("/b", factory);
      b.type.catch(() => {});
      expect(getMetaEntry("/b", factory)).toBe(b);
      await expect(b.meta).rejects.toThrow("network");
      expect(metaSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("onMetaCacheReset listeners run on every reset; getMetaCacheIdentity reports the binding", () => {
    const listener = vi.fn();
    const off = onMetaCacheReset(listener);
    resetMetaCache();
    setMetaCacheIdentity("9:test");
    expect(getMetaCacheIdentity()).toBe("9:test");
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    resetMetaCache();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
