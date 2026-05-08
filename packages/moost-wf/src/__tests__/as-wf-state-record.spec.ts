import { createAdapter } from "@atscript/db-sqlite";
import { syncSchema } from "@atscript/db/sync";
import { describe, expect, it } from "vite-plus/test";

import { TestWfStateRecord } from "./fixtures/test-wf-state.as";

async function setupTable() {
  const space = createAdapter(":memory:");
  await syncSchema(space, [TestWfStateRecord], { force: true });
  const table = space.getTable(TestWfStateRecord);
  return { space, table };
}

describe("AsWfStateRecord — base schema contract", () => {
  it("round-trips an inserted row through findOne", async () => {
    const { table } = await setupTable();

    const now = Date.now();
    const stateBlob = {
      context: { user: "alice", token: "abc" },
      indexes: [0, 1, 2],
      meta: { source: "import", attempt: 3 },
    };

    await table.insertOne({
      handle: "wf-handle-1",
      schemaId: "InviteForm",
      state: stateBlob,
      createdAt: now,
      createdBy: "alice",
    });

    const row = await table.findOne({ filter: { handle: "wf-handle-1" } });

    expect(row).toBeTruthy();
    if (!row) return;
    expect(typeof row.id).toBe("string");
    expect(row.id.length).toBeGreaterThan(0);
    expect(row.handle).toBe("wf-handle-1");
    expect(row.schemaId).toBe("InviteForm");
    expect(row.state).toEqual(stateBlob);
    expect(row.createdAt).toBe(now);
    expect(row.createdBy).toBe("alice");
  });

  it("rejects a duplicate handle via the unique index", async () => {
    const { table } = await setupTable();

    const now = Date.now();
    const baseRow = {
      schemaId: "InviteForm",
      state: { context: null, indexes: [] },
      createdAt: now,
    };

    await table.insertOne({ ...baseRow, handle: "wf-dupe" });

    let err: unknown;
    try {
      await table.insertOne({ ...baseRow, handle: "wf-dupe" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeTruthy();
    // SQLite surfaces UNIQUE-constraint failures with the literal "UNIQUE"
    // token in the message; the exact wrapper shape is engine-specific so
    // we only assert the violation surfaced at all + match on substring.
    const msg = err instanceof Error ? err.message : String(err);
    expect(msg.toLowerCase()).toMatch(/unique|constraint|duplicate/);
  });

  it("populates updatedAt via @db.default.now when omitted", async () => {
    const { table } = await setupTable();

    const t0 = Date.now() - 1; // tolerate 1ms granularity
    await table.insertOne({
      handle: "wf-default-now",
      schemaId: "InviteForm",
      state: { context: {}, indexes: [] },
      createdAt: t0,
      // updatedAt omitted intentionally
    });

    const row = await table.findOne({ filter: { handle: "wf-default-now" } });

    expect(row).toBeTruthy();
    if (!row) return;
    expect(typeof row.updatedAt).toBe("number");
    expect(row.updatedAt).toBeGreaterThanOrEqual(t0);
  });
});
