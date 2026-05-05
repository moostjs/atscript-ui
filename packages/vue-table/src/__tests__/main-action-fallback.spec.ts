import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import type { Client, TDbActionInfo } from "@atscript/db-client";
import { createTableState } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import { mockColumn, mockTableDef } from "./helpers";

interface MountOpts {
  rowActions?: TDbActionInfo[];
  defaultRow?: TDbActionInfo;
  actionImpl?: () => Promise<unknown>;
}

function mountState(opts: MountOpts = {}) {
  const actionFn = vi.fn(opts.actionImpl ?? (async () => ({ ok: true })));
  const removeFn = vi.fn(async () => ({ deletedCount: 1 }));
  const client = {
    meta: () => Promise.resolve({} as never),
    pages: () => Promise.resolve({ data: [], count: 0, page: 1, itemsPerPage: 50, pages: 1 }),
    action: actionFn,
    remove: removeFn,
  } as unknown as Client;

  let state!: ReactiveTableState;
  mount(
    defineComponent({
      setup() {
        const { state: s, internals } = createTableState({
          client,
          query: { queryOnMount: false },
        });
        state = s;
        const def = mockTableDef([mockColumn("id"), mockColumn("name")]);
        if (opts.rowActions) {
          def.actions = {
            ...def.actions,
            row: opts.rowActions,
            default: { ...def.actions.default, row: opts.defaultRow },
          };
        }
        internals.init(def);
        // Seed a row at index 0 so getActiveRow() returns it.
        state.windowCache.value = new Map([[0, { id: "user-1" }]]);
        state.results.value = [{ id: "user-1" }];
        state.totalCount.value = 1;
        return () => h("div");
      },
    }),
  );
  return { state, actionFn, removeFn };
}

const block: TDbActionInfo = {
  name: "block",
  label: "Block",
  level: "row",
  processor: "backend",
  value: "/users/actions/block",
};

describe("main-action fallback", () => {
  it("invokes default row action when no listener is registered", async () => {
    const { state, actionFn } = mountState({
      rowActions: [{ ...block, default: true }],
      defaultRow: { ...block, default: true },
    });
    state.setActive(0);
    state.requestMainAction(new KeyboardEvent("keydown"));
    await Promise.resolve();
    await Promise.resolve();
    expect(actionFn).toHaveBeenCalledWith("block", { id: "user-1" }, undefined);
  });

  it("registered listener wins over fallback", async () => {
    const { state, actionFn } = mountState({
      rowActions: [{ ...block, default: true }],
      defaultRow: { ...block, default: true },
    });
    const listener = vi.fn();
    state.registerMainActionListener(listener);
    state.setActive(0);
    const ev = new KeyboardEvent("keydown");
    state.requestMainAction(ev);
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(actionFn).not.toHaveBeenCalled();
  });

  it("no-op when neither listener nor default action present", async () => {
    const { state, actionFn } = mountState();
    state.setActive(0);
    state.requestMainAction(new KeyboardEvent("keydown"));
    await Promise.resolve();
    expect(actionFn).not.toHaveBeenCalled();
  });

  it("Enter key (handleNavKey) routes through requestMainAction → fallback", async () => {
    const { state, actionFn } = mountState({
      rowActions: [{ ...block, default: true }],
      defaultRow: { ...block, default: true },
    });
    state.setActive(0);
    const ev = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    state.handleNavKey(ev);
    await Promise.resolve();
    await Promise.resolve();
    expect(actionFn).toHaveBeenCalledWith("block", { id: "user-1" }, undefined);
  });

  it("requestMainAction with no active row is a no-op even with default", async () => {
    const { state, actionFn } = mountState({
      rowActions: [{ ...block, default: true }],
      defaultRow: { ...block, default: true },
    });
    state.requestMainAction(new KeyboardEvent("keydown"));
    await Promise.resolve();
    expect(actionFn).not.toHaveBeenCalled();
  });

  it("event reference is forwarded to invoke (and emits)", async () => {
    const { state } = mountState({
      rowActions: [{ ...block, default: true }],
      defaultRow: { ...block, default: true },
    });
    state.setActive(0);
    const ev = new MouseEvent("click");
    state.requestMainAction(ev);
    await Promise.resolve();
    await Promise.resolve();
    // The fallback path goes through actions.invoke, which records lastResult.
    expect(state.actions.lastResult.value.has("block")).toBe(true);
  });

  it("invoke() short-circuits for getActivePk on no-pk tables", async () => {
    const { state, actionFn } = mountState({
      rowActions: [{ ...block, default: true }],
      defaultRow: { ...block, default: true },
    });
    // Replace tableDef so primaryKeys + preferredId are empty (simulating
    // a no-identifier table — both clear, since `preferredId` defaults to
    // `primaryKeys` only when undefined on the wire, not when explicitly
    // emptied).
    const def = state.tableDef.value!;
    state.tableDef.value = { ...def, primaryKeys: [], preferredId: [] };
    state.setActive(0);
    state.requestMainAction(new KeyboardEvent("keydown"));
    await Promise.resolve();
    await Promise.resolve();
    expect(actionFn).toHaveBeenCalledWith("block", undefined, undefined);
  });
});
