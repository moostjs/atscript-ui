import type { Client } from "@atscript/db-client";
import { serializeAnnotatedType } from "@atscript/typescript/utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetDefaultClientFactory, setDefaultClientFactory, type ClientFactory } from "../client-factory";
import { resolveValueHelp } from "../value-help/resolve";
import { getMetaEntry, resetMetaCache } from "./meta-cache";

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
  resetMetaCache();
  resetDefaultClientFactory();
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
});
