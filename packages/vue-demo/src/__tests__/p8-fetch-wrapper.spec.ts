import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { on401, on403, on410, on500 } from "../client/api/error-bus";
import { sharedFetch } from "../client/api/fetch";

function mockResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    statusText: "test",
    headers: { "content-type": "application/json" },
  });
}

describe("sharedFetch error mapping", () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("401 on non-silent URL emits on401", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(401));
    const fired = vi.fn();
    const off = on401.on(fired);
    await sharedFetch("http://localhost/api/db/tables/products/query");
    expect(fired).toHaveBeenCalledTimes(1);
    off();
  });

  it("401 on /api/me is silent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(401));
    const fired = vi.fn();
    const off = on401.on(fired);
    await sharedFetch("http://localhost/api/me");
    expect(fired).not.toHaveBeenCalled();
    off();
  });

  it("403 emits on403 with server message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(403, { message: "Not allowed" }));
    const fired = vi.fn();
    const off = on403.on(fired);
    await sharedFetch("http://localhost/api/db/tables/users/query");
    expect(fired).toHaveBeenCalledWith(expect.objectContaining({ message: "Not allowed" }));
    off();
  });

  it("410 emits on410", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(410));
    const fired = vi.fn();
    const off = on410.on(fired);
    await sharedFetch("http://localhost/api/anywhere");
    expect(fired).toHaveBeenCalledTimes(1);
    off();
  });

  it("500 emits on500 with retry closure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(500, { message: "boom" }));
    globalThis.fetch = fetchMock;
    let captured: { status: number; message: string; retry: () => Promise<Response> } | null = null;
    const off = on500.on((e) => {
      captured = e;
    });
    await sharedFetch("http://localhost/api/something");
    expect(captured!.status).toBe(500);
    expect(captured!.message).toBe("boom");
    await captured!.retry();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    off();
  });
});
