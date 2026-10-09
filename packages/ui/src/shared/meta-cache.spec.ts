import { AsyncLocalStorage } from "node:async_hooks";
import { Client } from "@atscript/db-client";
import { serializeAnnotatedType } from "@atscript/typescript/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetDefaultClientFactory,
  setDefaultClientFactory,
  type ClientFactory,
} from "../client-factory";
import { resolveValueHelp } from "../value-help/resolve";
import { getMetaEntry, resetMetaCache, setMetaCacheIdentity } from "./meta-cache";

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
});
