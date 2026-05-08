import type { WfState } from "@prostojs/wf/outlets";
import { describe, expect, it } from "vite-plus/test";

import { AsWfStore } from "../store/wf-store";
import { setupTable } from "./helpers";

async function setupStore(opts?: {
  clock?: { now(): number };
  actor?: () => string | undefined;
}) {
  const { space, table } = await setupTable();
  const store = new AsWfStore({
    // biome-ignore lint/suspicious/noExplicitAny: subtype generic — store only touches base columns
    table: table as any,
    clock: opts?.clock,
    actor: opts?.actor,
  });
  return { space, table, store };
}

function makeState(overrides?: Partial<WfState>): WfState {
  return {
    schemaId: "InviteForm",
    context: { user: "alice" },
    indexes: [0],
    ...overrides,
  } as WfState;
}

describe("AsWfStore", () => {
  it("round-trips set → get", async () => {
    const { store } = await setupStore();
    const state = makeState({ context: { foo: "bar", n: 42 } });

    await store.set("h1", state);
    const result = await store.get("h1");

    expect(result).toBeTruthy();
    expect(result?.state).toEqual(state);
    expect(result?.expiresAt).toBeUndefined();
  });

  it("lifts schemaId to the top-level row column and reattaches on read", async () => {
    const { store, table } = await setupStore();
    const state = makeState({ schemaId: "RegisterFlow" });

    await store.set("h-lift", state);
    const row = await table.findOne({ filter: { handle: "h-lift" } });

    expect(row).toBeTruthy();
    if (!row) return;
    expect(row.schemaId).toBe("RegisterFlow");

    // Round-trip restores the full WfState including schemaId.
    const result = await store.get("h-lift");
    expect(result?.state.schemaId).toBe("RegisterFlow");
    expect(result?.state).toEqual(state);
  });

  it("treats expired rows as missing and opportunistically deletes", async () => {
    const now = Date.now();
    const { store, table } = await setupStore({ clock: { now: () => now } });

    await store.set("h-ttl", makeState(), now - 1);
    const result = await store.get("h-ttl");
    expect(result).toBeNull();

    // Wait a microtask for the fire-and-forget deletion to settle.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const row = await table.findOne({ filter: { handle: "h-ttl" } });
    expect(row).toBeNull();
  });

  it("preserves createdAt/createdBy across re-set, updates updatedAt/lastUpdatedBy", async () => {
    let t = 1000;
    let who: string = "alice";
    const { store, table } = await setupStore({
      clock: { now: () => t },
      actor: () => who,
    });

    await store.set("h-up", makeState({ context: { v: 1 } }));
    t = 2000;
    who = "bob";
    await store.set("h-up", makeState({ context: { v: 2 } }));

    const row = await table.findOne({ filter: { handle: "h-up" } });
    expect(row).toBeTruthy();
    if (!row) return;
    expect(row.createdAt).toBe(1000);
    expect(row.createdBy).toBe("alice");
    expect(row.updatedAt).toBe(2000);
    expect(row.lastUpdatedBy).toBe("bob");
    expect((row.state as WfState).context).toEqual({ v: 2 });
  });

  it("delete is a no-op on a missing handle", async () => {
    const { store } = await setupStore();
    await expect(store.delete("nope")).resolves.toBeUndefined();
  });

  it("getAndDelete returns the row and removes it", async () => {
    const { store } = await setupStore();
    await store.set("h-once", makeState());

    const first = await store.getAndDelete("h-once");
    expect(first?.state).toBeTruthy();

    const second = await store.get("h-once");
    expect(second).toBeNull();
  });

  it("getAndDelete is race-safe — only one concurrent caller wins", async () => {
    const { store } = await setupStore();
    await store.set("h-race", makeState());

    const [a, b] = await Promise.all([
      store.getAndDelete("h-race"),
      store.getAndDelete("h-race"),
    ]);

    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);
  });

  it("cleanup() with default retention deletes only expired rows", async () => {
    const now = Date.now();
    const { store, table } = await setupStore({ clock: { now: () => now } });

    await store.set("h-expired", makeState({ context: { tag: "x" } }), now - 1);
    await store.set("h-live", makeState({ context: { tag: "l" } }), now + 10000);
    await store.set("h-noexp", makeState({ context: { tag: "n" } }));

    const deleted = await store.cleanup();
    expect(deleted).toBe(1);

    const live = await table.findOne({ filter: { handle: "h-live" } });
    const noexp = await table.findOne({ filter: { handle: "h-noexp" } });
    const expired = await table.findOne({ filter: { handle: "h-expired" } });
    expect(live).toBeTruthy();
    expect(noexp).toBeTruthy();
    expect(expired).toBeNull();
  });

  it("cleanup({ retention: N }) only deletes rows past retention", async () => {
    const now = Date.now();
    const { store, table } = await setupStore({ clock: { now: () => now } });

    await store.set("h-recent", makeState({ context: { tag: "r" } }), now - 100);
    await store.set("h-old", makeState({ context: { tag: "o" } }), now - 10000);

    const deleted = await store.cleanup({ retention: 1000 });
    expect(deleted).toBe(1);

    const recent = await table.findOne({ filter: { handle: "h-recent" } });
    const old = await table.findOne({ filter: { handle: "h-old" } });
    expect(recent).toBeTruthy();
    expect(old).toBeNull();
  });

  it("cleanup({ retention: Infinity }) is a no-op", async () => {
    const now = Date.now();
    const { store, table } = await setupStore({ clock: { now: () => now } });

    await store.set("h1", makeState(), now - 1);
    await store.set("h2", makeState(), now + 100);

    const deleted = await store.cleanup({ retention: Number.POSITIVE_INFINITY });
    expect(deleted).toBe(0);

    expect(await table.findOne({ filter: { handle: "h1" } })).toBeTruthy();
    expect(await table.findOne({ filter: { handle: "h2" } })).toBeTruthy();
  });

  it("uses the injected clock for createdAt/updatedAt", async () => {
    const { store, table } = await setupStore({ clock: { now: () => 1000 } });

    await store.set("h-clock", makeState());
    const row = await table.findOne({ filter: { handle: "h-clock" } });
    expect(row).toBeTruthy();
    if (!row) return;
    expect(row.createdAt).toBe(1000);
    expect(row.updatedAt).toBe(1000);
  });
});
