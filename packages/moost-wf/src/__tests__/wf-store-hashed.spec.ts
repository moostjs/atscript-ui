import { HandleStateStrategy, hashWfHandle, type WfState } from "@prostojs/wf/outlets";
import { createHttpApp } from "@wooksjs/event-http";
import { createWfApp } from "@wooksjs/event-wf";
import { beforeAll, describe, expect, it } from "vite-plus/test";

import { handleAsOutletRequest } from "../handle";
import { createAsHttpOutlet } from "../outlet";
import { useAtscriptWf } from "../wf-io/use-atscript-wf";
import type { AsWfStore } from "../store/wf-store";
import { I18nForm } from "./fixtures/wf-forms.as";
import { setupStore } from "./helpers";

const state = (context: Record<string, unknown> = { user: "alice" }): WfState =>
  ({ schemaId: "hashed/form", context, indexes: [0] }) as WfState;

/** All `handle` column values of the store's table. */
async function storedKeys(store: AsWfStore): Promise<string[]> {
  const rows = (await (
    store as unknown as { table: { findMany(q: unknown): Promise<unknown[]> } }
  ).table.findMany({ filter: {} })) as Array<{ handle: string }>;
  return rows.map((r) => r.handle);
}

describe("AsWfStore with hashed handles (HandleStateStrategy hashHandles)", () => {
  it("stores the hash of a handle, never the handle itself", async () => {
    const { store } = await setupStore();
    const strategy = new HandleStateStrategy({ store, hashHandles: true });
    const token = await strategy.persist(state());

    expect(await storedKeys(store)).toEqual([hashWfHandle(token)]);
    expect(await storedKeys(store)).not.toContain(token);
    expect((await strategy.retrieve(token))?.context).toEqual({ user: "alice" });
    expect((await strategy.consume(token))?.context).toEqual({ user: "alice" });
    expect(await storedKeys(store)).toEqual([]);
    expect(await strategy.consume(token)).toBeNull();
  });

  it("with a secret, keys by HMAC", async () => {
    const { store } = await setupStore();
    const strategy = new HandleStateStrategy({ store, hashHandles: { secret: "s3cret" } });
    const token = await strategy.persist(state());
    expect(await storedKeys(store)).toEqual([hashWfHandle(token, "s3cret")]);
  });

  it("still resumes a handle stored raw before hashing was turned on, once", async () => {
    const { store } = await setupStore();
    // Written by a strategy without `hashHandles` (the previous release).
    const legacy = await new HandleStateStrategy({ store }).persist(state({ step: "legacy" }));
    expect(await storedKeys(store)).toEqual([legacy]);

    const strategy = new HandleStateStrategy({ store, hashHandles: true });
    expect((await strategy.retrieve(legacy))?.context).toEqual({ step: "legacy" });
    expect((await strategy.consume(legacy))?.context).toEqual({ step: "legacy" });
    expect(await storedKeys(store)).toEqual([]);
    expect(await strategy.consume(legacy)).toBeNull();
  });
});

describe("resuming an unusable handle answers 410 with a code", () => {
  const http = createHttpApp();
  const wf = createWfApp<Record<string, unknown>>();
  let store: AsWfStore;

  beforeAll(async () => {
    store = (await setupStore()).store;
    const strategy = new HandleStateStrategy({ store, hashHandles: true });
    wf.step("hashed-ask", { handler: () => void useAtscriptWf(I18nForm).resolveInput() });
    wf.flow("hashed/form", ["hashed-ask"]);
    http.post("/wf", () =>
      handleAsOutletRequest(
        {
          allow: ["hashed/form"],
          state: strategy,
          outlets: [createAsHttpOutlet()],
          token: { read: ["body"], write: "body", name: "wfs" },
        },
        {
          start: (schemaId, context, opts) => wf.start(schemaId, context as never, opts as never),
          resume: (s, opts) => wf.resume(s as never, opts as never),
        },
      ),
    );
  });

  async function post(body: Record<string, unknown>) {
    const res = (await http.request("/wf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }))!;
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  it("a consumed handle", async () => {
    const start = await post({ wfid: "hashed/form" });
    const wfs = start.json.wfs as string;
    expect((await post({ wfs, input: { formData: { name: "Alice" } } })).json.finished).toBe(true);
    expect(await post({ wfs })).toMatchObject({ status: 410, json: { code: "WF_EXPIRED" } });
  });

  it("an unknown handle", async () => {
    const start = await post({ wfid: "hashed/form" });
    const name = (start.json.wfs as string).split(".")[0];
    expect(await post({ wfs: `${name}.AAAAAAAAAAAAAAAAAAAAAA` })).toMatchObject({
      status: 410,
      json: { code: "WF_EXPIRED" },
    });
  });

  it("an expired handle", async () => {
    const start = await post({ wfid: "hashed/form" });
    const [name, handle] = (start.json.wfs as string).split(".");
    // Expire the stored row (keyed by the hash).
    await store.set(hashWfHandle(handle!), state(), Date.now() - 1000);
    expect(await post({ wfs: `${name}.${handle}` })).toMatchObject({
      status: 410,
      json: { code: "WF_EXPIRED" },
    });
  });

  it("a malformed token", async () => {
    expect(await post({ wfs: "nope" })).toMatchObject({
      status: 410,
      json: { code: "WF_INVALID_TOKEN" },
    });
  });
});
