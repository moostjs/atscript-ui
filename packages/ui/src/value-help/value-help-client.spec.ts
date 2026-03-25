import { serializeAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it, vi } from "vitest";
import type { MetaResponse } from "../table/types";
import { createValueHelpClient } from "./value-help-client";

// ── Helpers ──────────────────────────────────────────────────

async function buildMetaResponse(overrides?: Partial<MetaResponse>): Promise<MetaResponse> {
  const { Author } = await import("../__tests__/fixtures/value-help-target.as");
  return {
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: ["id"],
    readOnly: false,
    relations: [],
    fields: {
      id: { sortable: true, filterable: true },
      name: { sortable: true, filterable: true },
      bio: { sortable: false, filterable: true },
      email: { sortable: false, filterable: true },
      country: { sortable: false, filterable: true },
    },
    type: serializeAnnotatedType(Author),
    ...overrides,
  };
}

function mockFetch(responses: Record<string, { status: number; body?: unknown }>) {
  return vi.fn(async (url: string): Promise<Response> => {
    for (const [pattern, resp] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return {
          ok: resp.status >= 200 && resp.status < 300,
          status: resp.status,
          statusText: resp.status === 200 ? "OK" : "Error",
          json: async () => resp.body,
        } as Response;
      }
    }
    return { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) } as Response;
  }) as unknown as typeof globalThis.fetch & ReturnType<typeof vi.fn>;
}

// ── Tests ────────────────────────────────────────────────────

describe("createValueHelpClient", () => {
  describe("getMeta", () => {
    it("fetches and returns TargetTableMeta", async () => {
      const metaResp = await buildMetaResponse();
      const fetch = mockFetch({ "/authors/meta": { status: 200, body: metaResp } });
      const client = createValueHelpClient({ fetch });

      const meta = await client.getMeta("/authors");

      expect(meta).toBeDefined();
      expect(meta!.searchable).toBe(false);
      expect(meta!.primaryKeys).toEqual(["id"]);
      expect(meta!.tableDef).toBeDefined();
      expect(meta!.columns.length).toBeGreaterThan(0);
      expect(fetch).toHaveBeenCalledWith("/authors/meta");
    });

    it("caches meta response", async () => {
      const metaResp = await buildMetaResponse();
      const fetch = mockFetch({ "/authors/meta": { status: 200, body: metaResp } });
      const client = createValueHelpClient({ fetch });

      const a = await client.getMeta("/authors");
      const b = await client.getMeta("/authors");

      expect(a).toBe(b);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns undefined on 403", async () => {
      const fetch = mockFetch({ "/authors/meta": { status: 403 } });
      const client = createValueHelpClient({ fetch });

      const meta = await client.getMeta("/authors");
      expect(meta).toBeUndefined();
    });

    it("returns undefined on 401", async () => {
      const fetch = mockFetch({ "/authors/meta": { status: 401 } });
      const client = createValueHelpClient({ fetch });

      const meta = await client.getMeta("/authors");
      expect(meta).toBeUndefined();
    });

    it("prepends baseUrl", async () => {
      const metaResp = await buildMetaResponse();
      const fetch = mockFetch({ "/api/authors/meta": { status: 200, body: metaResp } });
      const client = createValueHelpClient({ baseUrl: "/api", fetch });

      await client.getMeta("/authors");
      expect(fetch).toHaveBeenCalledWith("/api/authors/meta");
    });
  });

  describe("query", () => {
    it("sends request with $select", async () => {
      const fetch = mockFetch({
        "/authors?": { status: 200, body: { items: [{ id: 1, name: "Alice" }], total: 1 } },
        "/authors/meta": { status: 200, body: await buildMetaResponse() },
      });
      const client = createValueHelpClient({ fetch });

      const result = await client.query("/authors", { select: ["id", "name"], limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      const url = decodeURIComponent(
        (fetch.mock.calls.find((c) => !String(c[0]).includes("/meta"))?.[0] ?? "") as string,
      );
      expect(url).toContain("$select=id,name");
      expect(url).toContain("$limit=10");
    });

    it("uses $search when target is searchable", async () => {
      const fetch = mockFetch({
        "/authors/meta": { status: 200, body: await buildMetaResponse({ searchable: true }) },
        "/authors?": { status: 200, body: [] },
      });
      const client = createValueHelpClient({ fetch });

      await client.query("/authors", { search: "ali", select: ["id", "name"] });

      const url = decodeURIComponent(
        (fetch.mock.calls.find((c) => !String(c[0]).includes("/meta"))?.[0] ?? "") as string,
      );
      expect(url).toContain("$search=ali");
      expect(url).not.toContain("$filter");
    });

    it("falls back to regex filter when not searchable", async () => {
      const fetch = mockFetch({
        "/authors/meta": { status: 200, body: await buildMetaResponse({ searchable: false }) },
        "/authors?": { status: 200, body: [] },
      });
      const client = createValueHelpClient({ fetch });

      await client.query("/authors", { search: "ali", select: ["id", "name"] });

      const url = decodeURIComponent(
        (fetch.mock.calls.find((c) => !String(c[0]).includes("/meta"))?.[0] ?? "") as string,
      );
      expect(url).toContain("$filter");
      expect(url).toContain("$or");
      expect(url).not.toContain("$search");
    });

    it("handles plain array response", async () => {
      const fetch = mockFetch({
        "/authors": { status: 200, body: [{ id: 1, name: "Alice" }] },
      });
      const client = createValueHelpClient({ fetch });

      const result = await client.query("/authors", {});
      expect(result.items).toHaveLength(1);
      expect(result.total).toBeUndefined();
    });
  });
});
