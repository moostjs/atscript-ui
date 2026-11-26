import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSSRApp, defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { useWfForm } from "../use-wf-form";
import type { UseWfFormOptions, UseWfFormReturn } from "../use-wf-form";
import { mockFetch, mockFinished, mockInputRequired, mountComposable } from "./helpers";

// Why: keeping a renewed token across a reload took ~30 lines of
// security-sensitive code in every page; `persistToken` does it once.

// The default key: `wf:<page>:<name>` (no router here: the pathname).
const KEY = "wf:/invite:users/invite";
const savedRun = (key = KEY) => JSON.parse(sessionStorage.getItem(key) ?? "null");
const saveRun = (run: unknown, key = KEY) => sessionStorage.setItem(key, JSON.stringify(run));

function invite(extra?: Partial<UseWfFormOptions>): UseWfFormOptions {
  return { path: "/api/wf", name: "users/invite", persistToken: "session", ...extra };
}

async function loginForm() {
  return (await import("./fixtures/login-form.as")).LoginForm;
}

/** Mount options for a page whose (Vue Router) route pattern is `path`, with `params`. */
function onPage(path: string, params: Record<string, string> = {}) {
  return {
    global: {
      config: {
        globalProperties: {
          $router: { currentRoute: { value: { matched: [{ path }], params } } },
        },
      },
    },
  };
}

function throwing(): never {
  throw new DOMException("no storage", "QuotaExceededError");
}

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  history.replaceState(null, "", "/invite");
});

afterEach(() => {
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

describe("useWfForm — persistToken", () => {
  it("is off by default: nothing stored, the link stays in the URL", async () => {
    history.replaceState(null, "", "/invite?wfs=link");
    mockFetch([mockInputRequired(await loginForm(), { token: "rotated" })]);

    mountComposable({ path: "/api/wf", name: "users/invite", initialToken: "link" });
    await flushPromises();

    expect(sessionStorage.length).toBe(0);
    expect(window.location.search).toBe("?wfs=link");
  });

  it("saves the start token before the first request, then every token change", async () => {
    const Form = await loginForm();
    const seen: unknown[] = [];
    mockFetch([
      () => {
        seen.push(savedRun());
        return mockInputRequired(Form, { token: "link" });
      },
      mockInputRequired(Form, { token: "rotated" }),
    ]);

    const { result } = mountComposable(invite({ initialToken: "link" }));
    await flushPromises();
    expect(seen[0]).toEqual({ link: "link", token: "link" });

    await result.submit({ username: "a" });
    await flushPromises();
    expect(savedRun()).toEqual({ link: "link", token: "rotated" });
  });

  it("a reload with the same link resumes from the saved token, with no echo", async () => {
    saveRun({ link: "link", token: "rotated" });
    const { calls } = mockFetch([mockInputRequired(await loginForm(), { token: "rotated" })]);

    const { result } = mountComposable(invite({ initialToken: "link", autoStart: false }));
    expect(result.token.value).toBe("rotated");
    await result.start();
    await flushPromises();

    expect(calls[0]!.body).toEqual({ wfid: "users/invite", wfs: "rotated" });
  });

  it("a reload with no link (dropped from the URL) resumes from the saved token", async () => {
    saveRun({ link: "link", token: "rotated" });
    const { calls } = mockFetch([mockInputRequired(await loginForm(), { token: "rotated" })]);

    mountComposable(invite());
    await flushPromises();

    expect(calls[0]!.body).toEqual({ wfid: "users/invite", wfs: "rotated" });
  });

  it("a different link starts from itself and replaces the entry", async () => {
    saveRun({ link: "old-link", token: "old-run" });
    const { calls } = mockFetch([mockInputRequired(await loginForm(), { token: "new-link" })]);

    mountComposable(invite({ initialToken: "new-link" }));
    await flushPromises();

    expect(calls[0]!.body).toEqual({ wfid: "users/invite", wfs: "new-link" });
    expect(savedRun()).toEqual({ link: "new-link", token: "new-link" });
  });

  it.each([
    ["a finish removes the entry", mockFinished(), null],
    ["an out-of-band pause removes the entry", { sent: true, outlet: "email" }, null],
    [
      "an in-band pause keeps the token it hands over",
      { outlet: "awaiting-payment", wfs: "pay" },
      { link: "link", token: "pay" },
    ],
  ])("%s", async (_, answer, expected) => {
    mockFetch([mockInputRequired(await loginForm(), { token: "link" }), answer]);

    const { result } = mountComposable(invite({ initialToken: "link" }));
    await flushPromises();
    expect(savedRun()).toEqual({ link: "link", token: "link" });
    await result.submit({ username: "a" });
    await flushPromises();

    expect(result.finished.value).toBe(true);
    expect(savedRun()).toEqual(expected);
  });

  it("after the run is over, start() begins a new run", async () => {
    const { calls } = mockFetch([
      mockInputRequired(await loginForm(), { token: "link" }),
      mockFinished(),
      mockInputRequired(await loginForm(), { token: "tok2" }),
    ]);

    const { result } = mountComposable(invite({ initialToken: "link" }));
    await flushPromises();
    await result.submit({ username: "a" });
    await flushPromises();
    await result.start();
    await flushPromises();

    expect(calls[2]!.body).toEqual({ wfid: "users/invite" });
  });

  it("uses the key override", async () => {
    mockFetch([mockInputRequired(await loginForm(), { token: "link" })]);

    mountComposable(invite({ initialToken: "link", persistTokenKey: "wf:invite-b" }));
    await flushPromises();

    expect(savedRun("wf:invite-b")).toEqual({ link: "link", token: "link" });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  describe("storage that fails keeps the run in memory", () => {
    it.each([
      [
        "methods throw",
        () => {
          vi.stubGlobal("sessionStorage", {
            getItem: throwing,
            setItem: throwing,
            removeItem: throwing,
          });
          return () => {};
        },
      ],
      [
        "access throws",
        () => {
          const own = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
          Object.defineProperty(globalThis, "sessionStorage", {
            configurable: true,
            get: throwing,
          });
          return () => Object.defineProperty(globalThis, "sessionStorage", own!);
        },
      ],
    ])("%s", async (_, breakStorage) => {
      const Form = await loginForm();
      const { calls } = mockFetch([
        mockInputRequired(Form, { token: "link" }),
        mockInputRequired(Form, { token: "rotated" }),
        mockFinished(),
      ]);
      const restore = breakStorage();
      try {
        const { result } = mountComposable(invite({ initialToken: "link" }));
        await flushPromises();
        await result.submit({ username: "a" });
        await flushPromises();
        await result.submit({ username: "b" });
        await flushPromises();

        expect(calls.map((c) => (c.body as { wfs?: string }).wfs)).toEqual([
          "link",
          "link",
          "rotated",
        ]);
        expect(result.error.value).toBeNull();
        expect(result.finished.value).toBe(true);
      } finally {
        restore();
      }
    });
  });

  // Why: Node 25+ has a process-wide `sessionStorage`, so a server render read
  // (and could leak) one tab's run into every request.
  it("SSR: setup touches neither window nor a defined sessionStorage", async () => {
    const { renderToString } = await import("vue/server-renderer");
    let result!: UseWfFormReturn;
    const app = createSSRApp(
      defineComponent({
        setup() {
          result = useWfForm(invite({ tokenTransport: "query", initialToken: "link" }));
          return () => h("div");
        },
      }),
    );
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("sessionStorage", storage);
    try {
      await renderToString(app);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(result.token.value).toBe("link");
  });

  // Why: an admin page and an invitee's link page run the same workflow; with
  // one key, the admin page (no link) picked up the invitee's renewed token.
  it("the default key holds the page: two pages running one workflow never share a run", async () => {
    const Form = await loginForm();
    const { calls } = mockFetch([
      mockInputRequired(Form, { token: "link" }),
      mockInputRequired(Form, { token: "renewed" }),
      mockInputRequired(Form, { token: "admin-run" }),
    ]);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const invitee = mountComposable(
      invite({ initialToken: "link", onLinkUsed: () => {} }),
      onPage("/invite/:token?"),
    );
    await flushPromises();
    await invitee.result.submit({ username: "a" });
    await flushPromises();
    expect(savedRun("wf:/invite:users/invite")).toEqual({ link: "link", token: "renewed" });

    mountComposable(invite(), onPage("/users/invite"));
    await flushPromises();
    expect(calls[2]!.body).toEqual({ wfid: "users/invite" });
  });

  // Why: the key held the route pattern only, so project 2's setup page
  // resumed the link-less run project 1's page had saved.
  it("the default key fills in route params: two param values get two runs", async () => {
    const Form = await loginForm();
    const { calls } = mockFetch([
      mockInputRequired(Form, { token: "run-1" }),
      mockInputRequired(Form, { token: "run-2" }),
    ]);

    mountComposable(invite(), onPage("/projects/:id/setup", { id: "1" }));
    await flushPromises();
    mountComposable(invite(), onPage("/projects/:id/setup", { id: "2" }));
    await flushPromises();

    expect(calls[1]!.body).toEqual({ wfid: "users/invite" });
    expect(savedRun("wf:/projects/1/setup:users/invite")).toEqual({ token: "run-1" });
    expect(savedRun("wf:/projects/2/setup:users/invite")).toEqual({ token: "run-2" });
  });

  it("a path-param link page keeps its key after the link leaves the URL", async () => {
    const Form = await loginForm();
    const { calls } = mockFetch([
      mockInputRequired(Form, { token: "renewed" }),
      mockInputRequired(Form, { token: "renewed" }),
    ]);
    const page = "/invite/:token?";

    mountComposable(
      invite({ initialToken: "link", onLinkUsed: () => {} }),
      onPage(page, { token: "link" }),
    );
    await flushPromises();
    expect(savedRun("wf:/invite:users/invite")).toEqual({ link: "link", token: "renewed" });

    // Reload after the link left the path.
    mountComposable(invite(), onPage(page));
    await flushPromises();
    expect(calls[1]!.body).toEqual({ wfid: "users/invite", wfs: "renewed" });
  });

  it("a query-link page keys on its route alone", async () => {
    history.replaceState(null, "", "/accept?wfs=link");
    mockFetch([mockInputRequired(await loginForm(), { token: "link" })]);

    mountComposable(invite({ tokenTransport: "query", onLinkUsed: () => {} }), onPage("/accept"));
    await flushPromises();

    expect(savedRun("wf:/accept:users/invite")).toEqual({ link: "link", token: "link" });
  });

  // Why: the link left the URL although nothing else held the run, so a reload
  // had neither.
  it("a failed save keeps the link in the URL", async () => {
    history.replaceState(null, "", "/invite?wfs=link");
    const Form = await loginForm();
    const { calls } = mockFetch([
      mockInputRequired(Form, { token: "link" }),
      mockInputRequired(Form, { token: "rotated" }),
    ]);
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: throwing,
      removeItem: throwing,
    });
    const onLinkUsed = vi.fn();

    const { result } = mountComposable(invite({ initialToken: "link", onLinkUsed }));
    await flushPromises();
    await result.submit({ username: "a" });
    await flushPromises();

    expect(onLinkUsed).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?wfs=link");
    expect((calls[1]!.body as { wfs?: string }).wfs).toBe("link");
    expect(result.token.value).toBe("rotated");
  });

  // Why: a run that started without a link and got a 410 kept a dead entry that
  // every reload and start() resent for the tab's lifetime.
  it("a 410 removes the entry of a run that did not start from a link", async () => {
    saveRun({ token: "dead" });
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(init?.body as string));
        return {
          ok: false,
          status: 410,
          json: async () => ({ message: "Gone", code: "WF_EXPIRED" }),
        } as unknown as Response;
      }),
    );

    const { result } = mountComposable(invite());
    await flushPromises();
    expect(bodies[0]).toEqual({ wfid: "users/invite", wfs: "dead" });
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(result.token.value).toBe("dead");

    await result.retry();
    await flushPromises();
    expect(bodies[1]).toEqual({ wfid: "users/invite", wfs: "dead" });

    mountComposable(invite());
    await flushPromises();
    expect(bodies[2]).toEqual({ wfid: "users/invite" });
  });

  it("cookie transport: stores nothing, but drops the link from the URL", async () => {
    history.replaceState(null, "", "/invite?wfs=link");
    const { calls } = mockFetch([mockInputRequired(await loginForm(), { token: "in-body" })]);

    mountComposable(invite({ tokenTransport: "cookie", initialToken: "link" }));
    await flushPromises();

    expect(calls[0]!.body).toEqual({ wfid: "users/invite", wfs: "link" });
    expect(sessionStorage.length).toBe(0);
    expect(window.location.search).toBe("");
  });

  // Why: the server sets the cookie only on success, so after a refused first
  // answer the link was the only copy — yet it left the URL and start() stopped
  // sending it.
  it("cookie transport: a refused first answer (not 410) keeps the link", async () => {
    history.replaceState(null, "", "/invite?wfs=link");
    const answers = [
      { ok: false, status: 503, body: { message: "Down" } },
      { ok: false, status: 403, body: { message: "Nope" } },
      { ok: true, status: 200, body: mockInputRequired(await loginForm()) },
    ];
    const bodies: unknown[] = [];
    let i = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(init?.body as string));
        const { ok, status, body } = answers[i++]!;
        return { ok, status, json: async () => body } as unknown as Response;
      }),
    );
    const onLinkUsed = vi.fn();

    const { result } = mountComposable(
      invite({ tokenTransport: "cookie", initialToken: "link", onLinkUsed }),
    );
    await flushPromises();
    expect(window.location.search).toBe("?wfs=link");

    await result.start();
    await flushPromises();
    expect(bodies[1]).toEqual({ wfid: "users/invite", wfs: "link" });
    expect(onLinkUsed).not.toHaveBeenCalled();

    await result.retry();
    await flushPromises();
    expect(bodies[2]).toEqual({ wfid: "users/invite", wfs: "link" });
    expect(onLinkUsed).toHaveBeenCalledTimes(1);
  });

  it("cookie transport: a 410 uses the link up (it is dead)", async () => {
    history.replaceState(null, "", "/invite?wfs=link");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: false,
            status: 410,
            json: async () => ({ code: "WF_EXPIRED" }),
          }) as unknown as Response,
      ),
    );

    mountComposable(invite({ tokenTransport: "cookie", initialToken: "link" }));
    await flushPromises();

    expect(window.location.search).toBe("");
  });

  describe("dropping the link", () => {
    it("without a router: history.replaceState removes it after the first answer", async () => {
      history.replaceState(null, "", "/invite?x=1&wfs=link");
      const Form = await loginForm();
      const during: string[] = [];
      mockFetch([
        () => {
          during.push(window.location.search);
          return mockInputRequired(Form, { token: "link" });
        },
      ]);

      mountComposable(invite({ initialToken: "link" }));
      await flushPromises();

      expect(during).toEqual(["?x=1&wfs=link"]);
      expect(window.location.search).toBe("?x=1");
    });

    it("leaves a different token in the URL alone", async () => {
      history.replaceState(null, "", "/invite?wfs=other");
      mockFetch([mockInputRequired(await loginForm(), { token: "link" })]);

      mountComposable(invite({ initialToken: "link" }));
      await flushPromises();

      expect(window.location.search).toBe("?wfs=other");
    });

    it("calls onLinkUsed once instead", async () => {
      history.replaceState(null, "", "/invite?wfs=link");
      const Form = await loginForm();
      mockFetch([
        mockInputRequired(Form, { token: "link" }),
        mockInputRequired(Form, { token: "rotated" }),
      ]);
      const onLinkUsed = vi.fn();

      const { result } = mountComposable(invite({ initialToken: "link", onLinkUsed }));
      await flushPromises();
      await result.submit({ username: "a" });
      await flushPromises();

      expect(onLinkUsed).toHaveBeenCalledTimes(1);
      expect(window.location.search).toBe("?wfs=link");
    });

    // Why: a page doing its own storage (or with cookie transport) needs to know
    // when the link can go, too.
    it.each(["body", "cookie"] as const)(
      "onLinkUsed fires without persistToken (%s transport), with no URL fallback",
      async (tokenTransport) => {
        history.replaceState(null, "", "/invite?wfs=link");
        mockFetch([mockInputRequired(await loginForm(), { token: "link" })]);
        const onLinkUsed = vi.fn();

        mountComposable({
          path: "/api/wf",
          name: "users/invite",
          tokenTransport,
          initialToken: "link",
          onLinkUsed,
        });
        await flushPromises();
        expect(onLinkUsed).toHaveBeenCalledTimes(1);

        onLinkUsed.mockClear();
        mountComposable({ path: "/api/wf", name: "users/invite", initialToken: "link" });
        await flushPromises();
        expect(window.location.search).toBe("?wfs=link");
      },
    );

    it("a throwing onLinkUsed does not turn a good answer into an error", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFetch([mockInputRequired(await loginForm(), { token: "link" })]);

      const { result } = mountComposable(
        invite({
          initialToken: "link",
          onLinkUsed: () => {
            throw new Error("router gone");
          },
        }),
      );
      await flushPromises();

      expect(result.error.value).toBeNull();
      expect(result.formDef.value).not.toBeNull();
      expect(error).toHaveBeenCalled();
    });

    it("with a router and no onLinkUsed: leaves the URL alone and warns", async () => {
      history.replaceState(null, "", "/invite?wfs=link");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockFetch([mockInputRequired(await loginForm(), { token: "link" })]);

      mountComposable(invite({ initialToken: "link" }), {
        global: { config: { globalProperties: { $router: {} } } },
      });
      await flushPromises();

      expect(window.location.search).toBe("?wfs=link");
      expect(warn.mock.calls.some(([m]) => String(m).includes("onLinkUsed"))).toBe(true);
    });

    it("a refused first answer uses the link up too", async () => {
      history.replaceState(null, "", "/invite?wfs=link");
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            ({
              ok: false,
              status: 410,
              json: async () => ({ message: "Gone", code: "WF_EXPIRED" }),
            }) as unknown as Response,
        ),
      );

      const { result } = mountComposable(invite({ initialToken: "link" }));
      await flushPromises();

      expect(result.error.value).toMatchObject({ status: 410 });
      expect(window.location.search).toBe("");
      expect(savedRun()).toEqual({ link: "link", token: "link" });
    });

    it("a network error does not: the link stays and retry() resends it", async () => {
      history.replaceState(null, "", "/invite?wfs=link");
      const bodies: unknown[] = [];
      let i = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) => {
          bodies.push(JSON.parse(init?.body as string));
          if (i++ === 0) throw new Error("offline");
          return { ok: true, json: async () => mockInputRequired(await loginForm()) };
        }),
      );

      const { result } = mountComposable(invite({ initialToken: "link" }));
      await flushPromises();
      expect(window.location.search).toBe("?wfs=link");

      await result.retry();
      await flushPromises();
      expect(bodies[1]).toEqual({ wfid: "users/invite", wfs: "link" });
      expect(window.location.search).toBe("");
    });
  });
});
