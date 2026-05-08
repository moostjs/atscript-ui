import { createAdapter } from "@atscript/db-sqlite";
import { syncSchema } from "@atscript/db/sync";
import type { WfState } from "@prostojs/wf/outlets";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { AsWfStore } from "../store/wf-store";
import { ShadowWfStateRecord } from "./fixtures/test-wf-state-shadow.as";

async function setupShadowStore(opts?: {
  clock?: { now(): number };
  actor?: () => string | undefined;
}) {
  const space = createAdapter(":memory:");
  await syncSchema(space, [ShadowWfStateRecord], { force: true });
  const table = space.getTable(ShadowWfStateRecord);
  const store = new AsWfStore({
    // biome-ignore lint/suspicious/noExplicitAny: subtype generic
    table: table as any,
    clock: opts?.clock,
    actor: opts?.actor,
  });
  return { space, table, store };
}

function makeState(overrides?: Partial<WfState>): WfState {
  return {
    schemaId: "ApprovalFlow",
    context: {},
    indexes: [0],
    ...overrides,
  } as WfState;
}

describe("AsWfStore — @wf.context.copy shadow columns", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("copies top-level context value to shadow column on set()", async () => {
    const { store, table } = await setupShadowStore();

    await store.set(
      "h-approver",
      makeState({ context: { approver: "alice", other: "ignored" } }),
    );
    const row = await table.findOne({ filter: { handle: "h-approver" } });
    expect(row?.approver).toBe("alice");
  });

  it("resolves nested dot-paths (approval.priority)", async () => {
    const { store, table } = await setupShadowStore();

    await store.set(
      "h-nested",
      makeState({ context: { approval: { priority: 7 } } }),
    );
    const row = await table.findOne({ filter: { handle: "h-nested" } });
    expect(row?.priority).toBe(7);
  });

  it("writes null when path doesn't resolve (optional field)", async () => {
    const { store, table } = await setupShadowStore();

    await store.set("h-miss", makeState({ context: { unrelated: 1 } }));
    const row = await table.findOne({ filter: { handle: "h-miss" } });
    expect(row?.approver).toBeNull();
    expect(row?.priority).toBeNull();
    expect(row?.urgent).toBeNull();
  });

  it("clears stale shadow value on subsequent set() with absent context", async () => {
    const { store, table } = await setupShadowStore();

    await store.set("h-clear", makeState({ context: { approver: "alice" } }));
    let row = await table.findOne({ filter: { handle: "h-clear" } });
    expect(row?.approver).toBe("alice");

    // Re-set with no approver in context — column must clear, not retain stale value.
    await store.set("h-clear", makeState({ context: { other: "x" } }));
    row = await table.findOne({ filter: { handle: "h-clear" } });
    expect(row?.approver).toBeNull();
  });

  it("type-mismatch writes null and warns once per field per store instance", async () => {
    const { store, table } = await setupShadowStore();

    // approver declared string, give it a number — write null + warn
    await store.set("h-mm-1", makeState({ context: { approver: 42 } }));
    let row = await table.findOne({ filter: { handle: "h-mm-1" } });
    expect(row?.approver).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Same field type-mismatch again — silent (already warned).
    await store.set("h-mm-2", makeState({ context: { approver: { obj: true } } }));
    row = await table.findOne({ filter: { handle: "h-mm-2" } });
    expect(row?.approver).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Different field type-mismatch — warns again (different field).
    await store.set("h-mm-3", makeState({ context: { urgent: "yes" } }));
    row = await table.findOne({ filter: { handle: "h-mm-3" } });
    expect(row?.urgent).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("ignores arrays at intermediate path segments (writes null)", async () => {
    const { store, table } = await setupShadowStore();

    // approval.priority but `approval` is an array → path doesn't resolve
    await store.set(
      "h-arr",
      makeState({ context: { approval: [{ priority: 5 }] } }),
    );
    const row = await table.findOne({ filter: { handle: "h-arr" } });
    expect(row?.priority).toBeNull();
  });

  it("preserves shadow values across re-set when context still carries them", async () => {
    const { store, table } = await setupShadowStore();

    await store.set("h-keep", makeState({ context: { approver: "alice" } }));
    await store.set("h-keep", makeState({ context: { approver: "bob" } }));
    const row = await table.findOne({ filter: { handle: "h-keep" } });
    expect(row?.approver).toBe("bob");
  });

  it("heal() backfills shadow columns on existing rows after annotation added", async () => {
    const { store, table } = await setupShadowStore();

    // Simulate "rows existed before the annotation was added" — insert directly
    // bypassing the store, so shadow columns stay null even though context
    // carries the values.
    const now = Date.now();
    await table.insertOne({
      handle: "h-old",
      schemaId: "ApprovalFlow",
      state: { context: { approver: "carol", urgent: true }, indexes: [0] },
      updatedAt: now,
      createdAt: now,
    });
    let row = await table.findOne({ filter: { handle: "h-old" } });
    expect(row?.approver).toBeNull();
    expect(row?.urgent).toBeNull();

    const healed = await store.heal();
    expect(healed).toBe(1);
    row = await table.findOne({ filter: { handle: "h-old" } });
    expect(row?.approver).toBe("carol");
    expect(row?.urgent).toBe(true);
  });

  it("heal() respects filter to scope the backfill", async () => {
    const { store, table } = await setupShadowStore();
    const now = Date.now();
    for (const h of ["a", "b", "c"]) {
      await table.insertOne({
        handle: h,
        schemaId: "ApprovalFlow",
        state: { context: { approver: `user-${h}` }, indexes: [0] },
        updatedAt: now,
        createdAt: now,
      });
    }

    const healed = await store.heal({ filter: { handle: "b" } });
    expect(healed).toBe(1);

    const a = await table.findOne({ filter: { handle: "a" } });
    const b = await table.findOne({ filter: { handle: "b" } });
    const c = await table.findOne({ filter: { handle: "c" } });
    expect(a?.approver).toBeNull();
    expect(b?.approver).toBe("user-b");
    expect(c?.approver).toBeNull();
  });

  it("scanShadowFields() caches across calls (single scan per store)", async () => {
    const { store } = await setupShadowStore();

    // Trigger scan via two writes — both should resolve specs identically.
    await store.set("h-cache-1", makeState({ context: { approver: "x" } }));
    await store.set("h-cache-2", makeState({ context: { approver: "y" } }));

    // Inspect cache via a subclass that exposes the protected scanner.
    class Inspectable extends AsWfStore {
      public peek() {
        return this.scanShadowFields();
      }
    }
    // biome-ignore lint/suspicious/noExplicitAny: reuse the same table instance
    const inspect = new Inspectable({ table: (store as any).table });
    const a = inspect.peek();
    const b = inspect.peek();
    expect(a).toBe(b); // same array reference → cached
    expect(a.map((s) => s.field).sort()).toEqual(["approver", "priority", "urgent"]);
  });
});

describe("AsWfStore — @wf.context.copy with no annotated fields", () => {
  it("heal() returns 0 when schema declares no shadow columns", async () => {
    // Use the non-shadow fixture (no @wf.context.copy on any field)
    const { TestWfStateRecord } = await import("./fixtures/test-wf-state.as");
    const space = createAdapter(":memory:");
    await syncSchema(space, [TestWfStateRecord], { force: true });
    const table = space.getTable(TestWfStateRecord);
    const store = new AsWfStore({
      // biome-ignore lint/suspicious/noExplicitAny: subtype generic
      table: table as any,
    });

    // Insert a row directly + run heal
    const now = Date.now();
    await table.insertOne({
      handle: "h-no-shadow",
      schemaId: "X",
      state: { context: {}, indexes: [0] },
      updatedAt: now,
      createdAt: now,
    });
    expect(await store.heal()).toBe(0);
  });
});
