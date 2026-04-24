import type { Client } from "@atscript/db-client";
import { serializeAnnotatedType } from "@atscript/typescript/utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetDefaultClientFactory,
  setDefaultClientFactory,
  type ClientFactory,
} from "../client-factory";
import { resetValueHelpCache, resolveValueHelp } from "./resolve";

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
    readOnly: false,
    relations: [],
    fields: {
      id: { sortable: true, filterable: true },
      name: { sortable: true, filterable: true },
      bio: { sortable: false, filterable: false },
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
    }) as unknown as Client;
  return { factory, metaSpy };
}

afterEach(() => {
  resetValueHelpCache();
  resetDefaultClientFactory();
});

describe("resolveValueHelp", () => {
  it("first call fetches /meta and extracts resolved shape", async () => {
    const serialized = await buildSerialized();
    const { factory, metaSpy } = makeFactory(async () => buildMetaResponse(serialized));
    setDefaultClientFactory(factory);

    const resolved = await resolveValueHelp("/authors");

    expect(metaSpy).toHaveBeenCalledTimes(1);
    expect(resolved.url).toBe("/authors");
    expect(resolved.primaryKeys).toEqual(["id"]);
    expect(resolved.labelField).toBe("name");
    expect(resolved.descrField).toBe("bio");
    expect(resolved.attrFields).toEqual(["email", "country"]);
    expect(resolved.filterableFields.toSorted()).toEqual(["id", "name"]);
    expect(resolved.sortableFields.toSorted()).toEqual(["id", "name"]);
    expect(resolved.searchable).toBe(true);
    expect(resolved.targetType).toBeDefined();
  });

  it("second call returns cached promise without fetching", async () => {
    const serialized = await buildSerialized();
    const { factory, metaSpy } = makeFactory(async () => buildMetaResponse(serialized));
    setDefaultClientFactory(factory);

    const a = await resolveValueHelp("/authors");
    const b = await resolveValueHelp("/authors");

    expect(metaSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("concurrent calls share the in-flight promise", async () => {
    const serialized = await buildSerialized();
    let resolveFn!: (v: unknown) => void;
    const { factory, metaSpy } = makeFactory(
      () =>
        new Promise((r) => {
          resolveFn = r;
        }),
    );
    setDefaultClientFactory(factory);

    const p1 = resolveValueHelp("/authors");
    const p2 = resolveValueHelp("/authors");

    expect(metaSpy).toHaveBeenCalledTimes(1);

    resolveFn(buildMetaResponse(serialized));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe(r2);
    expect(metaSpy).toHaveBeenCalledTimes(1);
  });

  it("rejected fetch evicts the cache entry so retries work", async () => {
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
});
