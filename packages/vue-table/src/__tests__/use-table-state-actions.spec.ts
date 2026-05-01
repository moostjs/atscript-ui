import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import type { Client, TDbActionInfo } from "@atscript/db-client";
import { createTableState } from "../composables/use-table-state";
import type { ActionResult, ReactiveTableState, TVueTableActionInfo } from "../types";
import { mockColumn, mockTableDef } from "./helpers";

interface MountOpts {
  refreshOnAction?: boolean;
  rowDelete?: boolean;
  actionImpl?: () => Promise<unknown>;
  removeImpl?: () => Promise<unknown>;
  onResolved?: (
    action: TVueTableActionInfo,
    ids: unknown[],
    result: ActionResult,
    event?: KeyboardEvent | MouseEvent,
  ) => void;
  rowActions?: TDbActionInfo[];
  canRemove?: boolean;
}

function mountActionsState(opts: MountOpts = {}) {
  const pagesFn = vi.fn().mockResolvedValue({
    data: [],
    count: 0,
    page: 1,
    itemsPerPage: 50,
    pages: 1,
  });
  const actionFn = vi.fn(opts.actionImpl ?? (async () => ({ ok: true })));
  const removeFn = vi.fn(opts.removeImpl ?? (async () => ({ deletedCount: 1 })));
  const client = {
    meta: () => Promise.resolve({} as never),
    pages: pagesFn,
    action: actionFn,
    remove: removeFn,
  } as unknown as Client;

  let state!: ReactiveTableState;
  mount(
    defineComponent({
      setup() {
        const refreshOnAction = opts.refreshOnAction ?? true;
        const { state: s, internals } = createTableState({
          client,
          query: { queryOnMount: false },
          actions: {
            refreshOnAction: () => refreshOnAction,
            onResolved: opts.onResolved,
          },
        });
        state = s;
        // `rowDelete` is renderer-owned — written via the renderer's watcher
        // in production. Tests poke the ref directly.
        state.rowDelete.value = opts.rowDelete ?? false;
        const def = mockTableDef([mockColumn("id"), mockColumn("name")]);
        if (opts.canRemove !== undefined) def.canRemove = opts.canRemove;
        if (opts.rowActions) def.actions = { ...def.actions, row: opts.rowActions };
        internals.init(def);
        return () => h("div");
      },
    }),
  );
  return { state, actionFn, removeFn, pagesFn };
}

const backendAction: TVueTableActionInfo = {
  name: "block",
  label: "Block",
  level: "row",
  processor: "backend",
  value: "/users/actions/block",
};

const navigateAction: TVueTableActionInfo = {
  name: "edit",
  label: "Edit",
  level: "row",
  processor: "navigate",
  value: "/users/$1/edit",
};

const customAction: TVueTableActionInfo = {
  name: "export",
  label: "Export",
  level: "table",
  processor: "custom",
  value: "export",
};

describe("state.actions.invoke", () => {
  it("backend success → result + refresh by default", async () => {
    const { state, actionFn, pagesFn } = mountActionsState();
    pagesFn.mockClear();
    const result = await state.actions.invoke(backendAction, "user-1");
    expect(actionFn).toHaveBeenCalledWith("block", "user-1");
    expect(result.ok).toBe(true);
    expect(state.actions.lastResult.value.get("block")).toMatchObject({
      ok: true,
      kind: "backend",
    });
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(pagesFn).toHaveBeenCalledTimes(1);
  });

  it("refreshOnAction=false skips post-success refresh", async () => {
    const { state, pagesFn } = mountActionsState({ refreshOnAction: false });
    pagesFn.mockClear();
    await state.actions.invoke(backendAction, "user-1");
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("opts.suppressRefresh wins over refreshOnAction=true", async () => {
    const { state, pagesFn } = mountActionsState();
    pagesFn.mockClear();
    await state.actions.invoke(backendAction, "user-1", { suppressRefresh: true });
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("suppressRefresh is per-call, not sticky", async () => {
    const { state, pagesFn } = mountActionsState();
    await state.actions.invoke(backendAction, "user-1", { suppressRefresh: true });
    pagesFn.mockClear();
    await state.actions.invoke(backendAction, "user-2");
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(pagesFn).toHaveBeenCalledTimes(1);
  });

  it("custom resolves immediately, no client call, no refresh", async () => {
    const { state, actionFn, pagesFn } = mountActionsState();
    pagesFn.mockClear();
    const result = await state.actions.invoke(customAction);
    expect(actionFn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, kind: "custom", dispatched: true });
    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("navigate calls client.action but does not refresh", async () => {
    const { state, actionFn, pagesFn } = mountActionsState();
    pagesFn.mockClear();
    const result = await state.actions.invoke(navigateAction, "user-1");
    expect(actionFn).toHaveBeenCalledWith("edit", "user-1");
    expect(result).toEqual({ ok: true, kind: "navigate" });
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("error is resolved (not thrown)", async () => {
    const { state, pagesFn } = mountActionsState({
      actionImpl: () => Promise.reject(new Error("boom")),
    });
    pagesFn.mockClear();
    const result = await state.actions.invoke(backendAction, "user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("error");
      expect(result.error.message).toBe("boom");
    }
    expect(state.actions.lastResult.value.get("block")?.ok).toBe(false);
    expect(state.actions.invoking.value.has("block")).toBe(false);
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("concurrent invokes track per-action flight independently", async () => {
    const release: Record<string, () => void> = {};
    const { state } = mountActionsState({
      actionImpl: function actionImpl(this: unknown, ...args: unknown[]) {
        const name = args[0] as string;
        return new Promise<unknown>((r) => {
          release[name] = () => r({ ok: true });
        });
      } as unknown as () => Promise<unknown>,
    });

    const a = state.actions.invoke({ ...backendAction, name: "a" }, 1);
    const b = state.actions.invoke({ ...backendAction, name: "b" }, 2);
    await nextTick();
    expect(state.actions.invoking.value.has("a")).toBe(true);
    expect(state.actions.invoking.value.has("b")).toBe(true);
    release.a?.();
    await a;
    expect(state.actions.invoking.value.has("a")).toBe(false);
    expect(state.actions.invoking.value.has("b")).toBe(true);
    release.b?.();
    await b;
    expect(state.actions.invoking.value.has("b")).toBe(false);
  });

  it("opts.event reference is forwarded to the onResolved bridge", async () => {
    const ev = new MouseEvent("click");
    const seen: { event?: KeyboardEvent | MouseEvent } = {};
    const { state } = mountActionsState({
      onResolved: (_action, _ids, _result, event) => {
        seen.event = event;
      },
    });
    await state.actions.invoke(backendAction, "user-1", { event: ev });
    expect(seen.event).toBe(ev);
  });

  it("lastResult populated for both success and error", async () => {
    const { state } = mountActionsState();
    await state.actions.invoke(backendAction, "ok-pk");
    expect(state.actions.lastResult.value.get("block")?.ok).toBe(true);
    const { state: errState } = mountActionsState({
      actionImpl: () => Promise.reject(new Error("nope")),
    });
    await errState.actions.invoke(backendAction, "fail-pk");
    expect(errState.actions.lastResult.value.get("block")?.ok).toBe(false);
  });
});
