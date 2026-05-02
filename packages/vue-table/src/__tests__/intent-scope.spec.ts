import { describe, expect, it, vi } from "vitest";
import {
  confirmAction,
  extractIdentifier,
  idsForAction,
  pkForLevel,
  substitute,
} from "../composables/state/intent-scope";
import type { ReactiveTableState, TVueTableActionInfo } from "../types";

describe("extractIdentifier", () => {
  it("picks preferredId fields from a row-shaped object", () => {
    expect(extractIdentifier({ id: 1, name: "x" }, ["id"])).toEqual({ id: 1 });
  });

  it("picks compound preferredId in declaration order (not key order)", () => {
    const row = { userId: "u1", tenantId: "acme", name: "x" };
    expect(extractIdentifier(row, ["tenantId", "userId"])).toEqual({
      tenantId: "acme",
      userId: "u1",
    });
  });

  it("wraps a scalar source into the single-field preferredId object", () => {
    // Consumers using `rowValueFn = (row) => row.id` keep working — the
    // identifier-object body is built at action-invocation time.
    expect(extractIdentifier("abc", ["id"])).toEqual({ id: "abc" });
    expect(extractIdentifier(42, ["id"])).toEqual({ id: 42 });
  });

  it("returns undefined for a scalar with compound preferredId", () => {
    expect(extractIdentifier("abc", ["tenantId", "userId"])).toBeUndefined();
  });

  it("returns undefined for null / undefined source", () => {
    expect(extractIdentifier(undefined, ["id"])).toBeUndefined();
    expect(extractIdentifier(null, ["id"])).toBeUndefined();
  });

  it("returns undefined when preferredId is empty", () => {
    expect(extractIdentifier({ id: 1 }, [])).toBeUndefined();
  });
});

describe("substitute", () => {
  it("substitutes $1 with formatted preferredId values", () => {
    expect(
      substitute("Delete $1?", {
        identifiers: [{ id: "abc" }],
        preferredId: ["id"],
      }),
    ).toBe("Delete abc?");
  });

  it("substitutes $N with the identifier count", () => {
    expect(
      substitute("Cancel $N orders?", {
        identifiers: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
        preferredId: ["id"],
      }),
    ).toBe("Cancel 4 orders?");
  });

  it("substitutes both $1 and $N in the same template", () => {
    expect(
      substitute("Action on $1 (and $N more)?", {
        identifiers: [{ id: "first" }, { id: "second" }, { id: "third" }],
        preferredId: ["id"],
      }),
    ).toBe("Action on first (and 3 more)?");
  });
});

function makeAction(opts: Partial<TVueTableActionInfo> = {}): TVueTableActionInfo {
  return {
    name: "act",
    label: "Act",
    level: "row",
    processor: "backend",
    value: "/x",
    ...opts,
  };
}

function makeState(promptResolver: (msg: string) => Promise<boolean>): ReactiveTableState {
  // Only `prompt` is exercised — cast keeps the surface narrow.
  return { prompt: vi.fn(promptResolver) } as unknown as ReactiveTableState;
}

describe("confirmAction", () => {
  it("resolves true immediately when the action declares no promptText", async () => {
    const state = makeState(async () => false); // would refuse, but never asked
    const ok = await confirmAction(state, makeAction(), {
      identifiers: [{ id: 1 }],
      preferredId: ["id"],
    });
    expect(ok).toBe(true);
    expect(state.prompt).not.toHaveBeenCalled();
  });

  it("forwards a string promptText with $1 / $N substitution", async () => {
    const state = makeState(async () => true);
    await confirmAction(state, makeAction({ promptText: "Block user $1 ($N selected)?" }), {
      identifiers: [{ id: "u1" }],
      preferredId: ["id"],
    });
    expect(state.prompt).toHaveBeenCalledWith("Block user u1 (1 selected)?", expect.any(Object));
  });

  it("picks the singular tuple form for at most one identifier", async () => {
    const state = makeState(async () => true);
    await confirmAction(
      state,
      makeAction({ promptText: ["Delete order $1?", "Delete $N orders?"] }),
      { identifiers: [{ id: "ORD-1" }], preferredId: ["id"] },
    );
    expect(state.prompt).toHaveBeenCalledWith("Delete order ORD-1?", expect.any(Object));
  });

  it("picks the plural tuple form for two or more identifiers", async () => {
    const state = makeState(async () => true);
    await confirmAction(
      state,
      makeAction({ promptText: ["Delete order $1?", "Delete $N orders?"] }),
      {
        identifiers: [{ id: "ORD-1" }, { id: "ORD-2" }, { id: "ORD-3" }],
        preferredId: ["id"],
      },
    );
    expect(state.prompt).toHaveBeenCalledWith("Delete 3 orders?", expect.any(Object));
  });

  it("falls back to singular when there are no identifiers (table-level)", async () => {
    const state = makeState(async () => true);
    await confirmAction(
      state,
      makeAction({ level: "table", promptText: ["Single $1", "Many $N"] }),
      { identifiers: [], preferredId: ["id"] },
    );
    expect(state.prompt).toHaveBeenCalledWith("Single ", expect.any(Object));
  });

  it("maps action intent to the prompt scope", async () => {
    const state = makeState(async () => true);
    await confirmAction(state, makeAction({ intent: "negative", promptText: "ok?" }), {
      identifiers: [{ id: 1 }],
      preferredId: ["id"],
    });
    expect(state.prompt).toHaveBeenCalledWith("ok?", { scope: "error" });
  });
});

describe("pkForLevel / idsForAction", () => {
  it("pkForLevel picks the right shape per level", () => {
    const ids = [{ id: "a" }, { id: "b" }];
    expect(pkForLevel("table", ids)).toBeUndefined();
    expect(pkForLevel("row", ids)).toEqual({ id: "a" });
    expect(pkForLevel("rows", ids)).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("idsForAction is the inverse of pkForLevel", () => {
    expect(idsForAction("table", undefined)).toEqual([]);
    expect(idsForAction("row", { id: "a" })).toEqual([{ id: "a" }]);
    expect(idsForAction("rows", [{ id: "a" }, { id: "b" }])).toEqual([{ id: "a" }, { id: "b" }]);
  });
});
