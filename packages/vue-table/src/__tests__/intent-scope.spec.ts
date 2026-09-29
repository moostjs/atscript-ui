import { describe, expect, it, vi } from "vitest";
import {
  applyGate,
  applyRowsGate,
  ariaDisabled,
  ariaLabelFor,
  confirmAction,
  extractIdentifier,
  idsForAction,
  isActionDisabled,
  pkForLevel,
  rowActionGate,
  rowsActionGate,
  substitute,
  triggerAction,
  triggerBindings,
  withVerdict,
} from "../composables/state/intent-scope";
import { REMOVE_PROCESSOR, type ReactiveTableState, type TVueTableActionInfo } from "../types";

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

describe("rowsActionGate / applyRowsGate", () => {
  function bulkAction(opts: Partial<TVueTableActionInfo> = {}): TVueTableActionInfo {
    return makeAction({ level: "rows", ...opts });
  }

  it("returns null when NO selected row carries a $actions array (no gating)", () => {
    expect(rowsActionGate([{ id: 1 }, { id: 2 }])).toBeNull();
    expect(rowsActionGate([])).toBeNull();
  });

  it("unions $actions across rows: shown when AT LEAST ONE selected row allows it", () => {
    const gate = rowsActionGate([{ $actions: ["a"] }, { $actions: ["b"] }]);
    expect(gate).not.toBeNull();
    expect(gate!(bulkAction({ name: "a" }))).toBe(true);
    expect(gate!(bulkAction({ name: "b" }))).toBe(true);
    expect(gate!(bulkAction({ name: "c" }))).toBe(false);
  });

  it("disables a normal action when every selected row spoke with an empty $actions", () => {
    // Empty arrays still count as "the server spoke" → gate is NOT null.
    const gate = rowsActionGate([{ $actions: [] }, { $actions: [] }]);
    expect(gate).not.toBeNull();
    expect(gate!(bulkAction({ name: "a" }))).toBe(false);
  });

  it("exempts the synthesised remove action even when absent from every row", () => {
    const gate = rowsActionGate([{ $actions: [] }, { $actions: ["other"] }]);
    expect(gate).not.toBeNull();
    expect(gate!(bulkAction({ name: REMOVE_PROCESSOR, processor: REMOVE_PROCESSOR }))).toBe(true);
  });

  it("applyRowsGate filters a {default, others, rows} triple by the union", () => {
    const keep = bulkAction({ name: "a" });
    const drop = bulkAction({ name: "c" });
    const out = applyRowsGate({ default: drop, others: [keep, drop], rows: [keep] }, [
      { $actions: ["a"] },
      { $actions: ["b"] },
    ]);
    expect(out.default).toBeUndefined();
    expect(out.others).toEqual([keep]);
    expect(out.rows).toEqual([keep]);
  });

  it("applyRowsGate returns the SAME buckets reference when gate is null", () => {
    const buckets = {
      default: bulkAction({ name: "a" }),
      others: [bulkAction({ name: "b" })],
      rows: [],
    };
    // Rows without $actions → null gate → identity-stable pass-through.
    expect(applyRowsGate(buckets, [{ id: 1 }, { id: 2 }])).toBe(buckets);
  });
});

describe("disabled reasons ($disabledReasons)", () => {
  const ship = makeAction({ name: "ship", label: "Ship" });
  const edit = makeAction({ name: "edit", label: "Edit" });
  const archive = makeAction({ name: "archive", label: "Archive" });

  describe("rowActionGate", () => {
    it("enabled → true, reasoned → the reason, neither → false", () => {
      const gate = rowActionGate({
        $actions: ["edit"],
        $disabledReasons: { ship: "Order already shipped" },
      })!;
      expect(gate(edit)).toBe(true);
      expect(gate(ship)).toBe("Order already shipped");
      expect(gate(archive)).toBe(false);
    });

    it("stays null without $actions, even when $disabledReasons is present", () => {
      expect(rowActionGate({ $disabledReasons: { ship: "x" } })).toBeNull();
    });

    it("an allowed name wins over a stray reason for the same action", () => {
      const gate = rowActionGate({ $actions: ["ship"], $disabledReasons: { ship: "x" } })!;
      expect(gate(ship)).toBe(true);
    });

    it("the synthesised remove action stays exempt", () => {
      const gate = rowActionGate({ $actions: [], $disabledReasons: {} })!;
      expect(gate(makeAction({ name: REMOVE_PROCESSOR, processor: REMOVE_PROCESSOR }))).toBe(true);
    });

    it("reads only own non-empty string reasons; a malformed payload only hides", () => {
      const reasons = { ship: "Already shipped", edit: "", archive: 1 };
      const gate = rowActionGate({ $actions: [], $disabledReasons: reasons })!;
      expect(gate(ship)).toBe("Already shipped");
      expect(gate(edit)).toBe(false);
      expect(gate(archive)).toBe(false);
      for (const bad of [["ship"], "ship", null]) {
        expect(rowActionGate({ $actions: [], $disabledReasons: bad })!(ship)).toBe(false);
      }
    });

    it("an action named after an Object.prototype member is never enabled by inheritance", () => {
      const ctor = makeAction({ name: "constructor" });
      const toStr = makeAction({ name: "toString" });
      const single = rowActionGate({ $actions: [], $disabledReasons: { ship: "x" } })!;
      expect(single(ctor)).toBe(false);
      expect(single(toStr)).toBe(false);
      const bulk = rowsActionGate([{ $actions: [], $disabledReasons: { ship: "x" } }])!;
      expect(bulk(ctor)).toBe(false);
      expect(bulk(toStr)).toBe(false);
      // …while an OWN reason under such a name works like any other.
      const own = rowActionGate({ $actions: [], $disabledReasons: { constructor: "Nope" } })!;
      expect(own(ctor)).toBe("Nope");
      expect(
        applyGate({ default: undefined, others: [ctor, toStr], rows: [] }, own).others,
      ).toEqual([{ ...ctor, disabledReason: "Nope" }]);
    });
  });

  describe("applyGate / withVerdict", () => {
    const row = { $actions: ["edit"], $disabledReasons: { ship: "Order already shipped" } };

    it("withVerdict: false drops, a non-empty string copies with the reason, else identity", () => {
      expect(withVerdict(ship, false)).toBeUndefined();
      expect(withVerdict(ship, true)).toBe(ship);
      expect(withVerdict(ship, "")).toBe(ship);
      expect(withVerdict(ship, "No")).toEqual({ ...ship, disabledReason: "No" });
    });

    it("keeps a reasoned action as a COPY carrying disabledReason; the source is untouched", () => {
      const out = applyGate(
        { default: ship, others: [edit, archive], rows: [] },
        rowActionGate(row),
      );
      expect(out.default).not.toBe(ship);
      expect(out.default).toEqual({ ...ship, disabledReason: "Order already shipped" });
      expect(ship.disabledReason).toBeUndefined();
      expect(out.others).toEqual([edit]);
      expect(out.others[0]).toBe(edit);
    });

    it("returns the SAME arrays / buckets when every verdict keeps the action as is", () => {
      const others = [edit];
      const rows = [edit];
      const buckets = { default: edit, others, rows };
      expect(applyGate(buckets, () => true)).toBe(buckets);
      const partly = applyGate({ default: ship, others, rows }, rowActionGate(row));
      expect(partly.others).toBe(others);
      expect(partly.rows).toBe(rows);
    });

    it("runs map on the disabled copy (per-screen overrides keep the reason)", () => {
      const out = applyGate(
        { default: undefined, others: [ship], rows: [] },
        rowActionGate(row),
        (a) => ({ ...a, label: "Dispatch" }),
      );
      expect(out.others[0]).toMatchObject({
        label: "Dispatch",
        disabledReason: "Order already shipped",
      });
    });

    it("isActionDisabled / ariaDisabled read the gated copy", () => {
      const out = applyGate({ default: ship, others: [edit], rows: [] }, rowActionGate(row));
      expect(isActionDisabled(out.default!)).toBe(true);
      expect(ariaDisabled(out.default!)).toBe("true");
      expect(isActionDisabled(out.others[0]!)).toBe(false);
      expect(ariaDisabled(out.others[0]!)).toBeUndefined();
    });
  });

  describe("rowsActionGate (bulk)", () => {
    const bulk = (name: string) => makeAction({ name, level: "rows" });

    it("enabled when ANY selected row allows it, even if another row gives a reason", () => {
      const gate = rowsActionGate([
        { $actions: ["archive"] },
        { $actions: [], $disabledReasons: { archive: "Locked" } },
      ])!;
      expect(gate(bulk("archive"))).toBe(true);
    });

    it("disabled with the distinct reasons joined when NO row allows it", () => {
      const gate = rowsActionGate([
        { $actions: [], $disabledReasons: { archive: "Locked" } },
        { $actions: [], $disabledReasons: { archive: "Already archived" } },
        { $actions: [], $disabledReasons: { archive: "Locked" } },
        { $actions: [] },
      ])!;
      expect(gate(bulk("archive"))).toBe("Locked; Already archived");
    });

    it("caps the listed reasons at three and counts the rest", () => {
      const rows = ["A", "B", "C", "D", "E"].map((r) => ({
        $actions: [],
        $disabledReasons: { archive: r },
      }));
      expect(rowsActionGate(rows)!(bulk("archive"))).toBe("A; B; C; +2 more");
    });

    it("hidden when no row allows it and none gave a reason", () => {
      const gate = rowsActionGate([{ $actions: [] }, { $actions: ["other"] }])!;
      expect(gate(bulk("archive"))).toBe(false);
    });

    it("applyRowsGate keeps the disabled copy in its bucket", () => {
      const a = bulk("archive");
      const out = applyRowsGate({ default: a, others: [], rows: [] }, [
        { $actions: [], $disabledReasons: { archive: "Locked" } },
      ]);
      expect(out.default).toEqual({ ...a, disabledReason: "Locked" });
    });
  });

  describe("triggers never run a disabled action", () => {
    const disabled = { ...ship, disabledReason: "Order already shipped" };

    function gestureState() {
      const invoke = vi.fn(async () => ({ ok: true }));
      const state = {
        prompt: vi.fn(async () => true),
        requestActionInput: vi.fn(async () => ({})),
        actions: { invoke },
        tableDef: { value: { preferredId: ["id"] } },
        resolveHref: (h: string) => h,
      } as unknown as ReactiveTableState;
      return { state, invoke };
    }

    it("ariaLabelFor appends the reason", () => {
      expect(ariaLabelFor(ship)).toBe("Ship");
      expect(ariaLabelFor(disabled)).toBe("Ship, Order already shipped");
    });

    it("triggerAction is a no-op (no prompt, no form, no invoke)", async () => {
      const { state, invoke } = gestureState();
      await triggerAction(
        state,
        { ...disabled, promptText: "Sure?" },
        { identifiers: [], preferredId: [] },
      );
      await triggerAction(state, { ...disabled, inputForm: { name: "f", url: "/f" } } as never, {
        identifiers: [],
        preferredId: [],
      });
      expect(state.prompt).not.toHaveBeenCalled();
      expect(state.requestActionInput).not.toHaveBeenCalled();
      expect(invoke).not.toHaveBeenCalled();
    });

    it("triggerBindings: a disabled trigger is an aria-disabled button with the reason", () => {
      const nav = makeAction({ name: "open", label: "Open", processor: "navigate" });
      expect(triggerBindings(nav, "/o/1")).toEqual({
        tag: "a",
        attrs: {
          href: "/o/1",
          type: undefined,
          "aria-disabled": undefined,
          "aria-label": "Open",
          title: "Open",
        },
      });
      // A disabled action never has an href (`rowActionHref`) — a button.
      expect(triggerBindings({ ...nav, disabledReason: "Archived" }, undefined)).toEqual({
        tag: "button",
        attrs: {
          href: undefined,
          type: "button",
          "aria-disabled": "true",
          "aria-label": "Open, Archived",
          title: "Open, Archived",
        },
      });
      // promptText keeps a navigate action a button (the confirm guards it).
      expect(triggerBindings({ ...nav, promptText: "Sure?" }, "/o/1").tag).toBe("button");
    });
  });
});
