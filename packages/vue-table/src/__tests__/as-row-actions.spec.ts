// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { Client, TDbActionInfo } from "@atscript/db-client";
import AsRowActions from "../components/defaults/as-row-actions.vue";
import { createTableState, provideTableContext } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import { mockColumn, mockTableDef } from "./helpers";

interface MountOpts {
  rowActions?: TDbActionInfo[];
  rowsActions?: TDbActionInfo[];
  defaultRow?: TDbActionInfo;
  rowDelete?: boolean;
  canRemove?: boolean;
  /** Identifier override forwarded to `<AsRowActions>` directly. */
  pk?: Record<string, unknown>;
  /** Forward NO identifier at all (no `pk`, no `row`) — models a pk-less row. */
  noPk?: boolean;
  /** Row data forwarded to `<AsRowActions>` (used for `$actions` filtering). */
  row?: Record<string, unknown>;
  /** Base-path mapper threaded to `state.resolveHref`. */
  resolveHref?: (url: string) => string;
}

const block: TDbActionInfo = {
  name: "block",
  label: "Block",
  level: "row",
  processor: "backend",
  value: "/users/actions/block",
  icon: "i-as-block",
};

function setup(opts: MountOpts = {}) {
  const actionFn = vi.fn(async () => ({ ok: true }));
  const removeFn = vi.fn(async () => ({ deletedCount: 1 }));
  const client = {
    meta: () => Promise.resolve({} as never),
    pages: () => Promise.resolve({ data: [], count: 0, page: 1, itemsPerPage: 50, pages: 1 }),
    action: actionFn,
    remove: removeFn,
  } as unknown as Client;

  let state!: ReactiveTableState;
  const Host = defineComponent({
    setup() {
      const { state: s, internals } = createTableState({
        client,
        query: { queryOnMount: false },
        actions: {
          refreshOnAction: () => true,
          resolveHref: opts.resolveHref,
        },
      });
      state = s;
      // `rowDelete` is renderer-owned: `<AsTable>` / `<AsWindowTable>` push
      // their `:row-delete` prop into `state.rowDelete.value` via watchers.
      // Tests bypass the renderer and write directly.
      state.rowDelete.value = opts.rowDelete ?? false;
      const def = mockTableDef([mockColumn("id"), mockColumn("name")]);
      if (opts.canRemove !== undefined) def.canRemove = opts.canRemove;
      if (opts.rowActions || opts.rowsActions) {
        def.actions = {
          ...def.actions,
          row: opts.rowActions ?? def.actions.row,
          rows: opts.rowsActions ?? def.actions.rows,
          default: { ...def.actions.default, row: opts.defaultRow },
        };
      }
      internals.init(def);
      provideTableContext({ state, client, controls: {} });
      return () =>
        h(AsRowActions, {
          pk: opts.noPk ? undefined : (opts.pk ?? { id: "user-1" }),
          row: opts.row,
        });
    },
  });
  const wrapper = mount(Host);
  return { wrapper, state, actionFn, removeFn };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<AsRowActions>", () => {
  it("renders nothing when no row actions", () => {
    const { wrapper } = setup();
    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("renders single icon button when 1 row action with icon", () => {
    const { wrapper } = setup({ rowActions: [block] });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.attributes("aria-label")).toBe("Block");
    expect(buttons[0]!.attributes("title")).toBe("Block");
    expect(wrapper.find(".i-as-block").exists()).toBe(true);
  });

  it("falls back to label text when icon absent", () => {
    const { wrapper } = setup({
      rowActions: [{ ...block, icon: undefined }],
    });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.text()).toBe("Block");
  });

  it("falls back to name text when both icon and label absent", () => {
    const { wrapper } = setup({
      rowActions: [{ ...block, icon: undefined, label: "" }],
    });
    const buttons = wrapper.findAll("button");
    expect(buttons[0]!.text()).toBe("block");
    expect(buttons[0]!.attributes("aria-label")).toBe("block");
  });

  it("renders single more-button when ≥2 row actions", () => {
    const { wrapper } = setup({
      rowActions: [block, { ...block, name: "lock", label: "Lock" }],
    });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.attributes("aria-label")).toBe("Row actions");
  });

  it("click invokes state.actions.invoke with the identifier object", async () => {
    const { wrapper, actionFn } = setup({ rowActions: [block], pk: { id: "user-42" } });
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(actionFn).toHaveBeenCalledWith("block", { id: "user-42" }, undefined);
  });

  it("with promptText, prompt-cancel skips invoke", async () => {
    const promptAction: TDbActionInfo = {
      ...block,
      promptText: "Really?",
    };
    const { wrapper, state, actionFn } = setup({ rowActions: [promptAction] });
    await wrapper.find("button").trigger("click");
    // Pending prompt request — dialog would render. Simulate user dismiss.
    expect(state.confirmRequest.value?.message).toBe("Really?");
    state.dismissPrompt();
    await flushPromises();
    expect(actionFn).not.toHaveBeenCalled();
  });

  it("with promptText, prompt-accept calls invoke", async () => {
    const promptAction: TDbActionInfo = {
      ...block,
      promptText: "Really?",
    };
    const { wrapper, state, actionFn } = setup({
      rowActions: [promptAction],
      pk: { id: "x" },
    });
    await wrapper.find("button").trigger("click");
    expect(state.confirmRequest.value?.message).toBe("Really?");
    state.acceptPrompt();
    await flushPromises();
    expect(actionFn).toHaveBeenCalledWith("block", { id: "x" }, undefined);
  });

  it("prompt request maps action intent → scope for the styled button", async () => {
    const promptAction: TDbActionInfo = {
      ...block,
      promptText: "Really?",
      intent: "negative",
    };
    const { wrapper, state } = setup({ rowActions: [promptAction] });
    await wrapper.find("button").trigger("click");
    expect(state.confirmRequest.value?.scope).toBe("error");
    state.dismissPrompt();
  });

  it("default row action listed first in dropdown", async () => {
    const lockAction: TDbActionInfo = {
      name: "lock",
      label: "Lock",
      level: "row",
      processor: "backend",
      value: "/x",
    };
    const { state } = setup({
      rowActions: [block, { ...lockAction, default: true }],
      defaultRow: { ...lockAction, default: true },
    });
    // Verify the order via state.actions.default.row
    expect(state.actions.default.row?.name).toBe("lock");
  });

  it("rowDelete=true adds __remove entry only when canRemove === true", () => {
    const { state: s1 } = setup({ rowDelete: true, canRemove: true });
    expect(s1.actions.row.find((a) => a.name === "__remove")).toBeDefined();

    const { state: s2 } = setup({ rowDelete: true, canRemove: false });
    expect(s2.actions.row.find((a) => a.name === "__remove")).toBeUndefined();

    const { state: s3 } = setup({ rowDelete: false, canRemove: true });
    expect(s3.actions.row.find((a) => a.name === "__remove")).toBeUndefined();
  });

  it("__remove never auto-defaults", () => {
    const { state } = setup({ rowDelete: true, canRemove: true });
    expect(state.actions.default.row?.name).not.toBe("__remove");
  });

  // ── per-row server-evaluated availability ───────────────────────────────

  describe("server-evaluated $actions filtering", () => {
    const ship: TDbActionInfo = {
      name: "ship",
      label: "Ship",
      level: "row",
      processor: "backend",
      value: "/orders/actions/ship",
    };
    const cancel: TDbActionInfo = {
      name: "cancel",
      label: "Cancel",
      level: "rows",
      processor: "backend",
      value: "/orders/actions/cancel",
    };
    const editNav: TDbActionInfo = {
      name: "edit",
      label: "Edit",
      level: "row",
      processor: "navigate",
      value: "/orders/$1/edit",
    };
    const exportCsv: TDbActionInfo = {
      name: "export",
      label: "Export",
      level: "row",
      processor: "custom",
      value: "",
    };

    it("hides backend actions absent from row.$actions", () => {
      const { wrapper } = setup({
        rowActions: [ship],
        rowsActions: [cancel],
        row: { id: "ord-1", $actions: ["ship"] },
      });
      // ship is allowed (in $actions), cancel is not — only one action
      // remains, so it collapses to the single labelled button.
      const btn = wrapper.find("button");
      expect(btn.attributes("aria-label")).toBe("Ship");
    });

    it("collapses to empty placeholder cell when all actions are filtered out", () => {
      const { wrapper } = setup({
        rowActions: [ship],
        rowsActions: [cancel],
        row: { id: "ord-1", $actions: [] },
      });
      expect(wrapper.findAll("button")).toHaveLength(0);
    });

    it("shows all actions when row.$actions is absent (legacy server / opt-out)", () => {
      const { wrapper } = setup({
        rowActions: [ship],
        rowsActions: [cancel],
        row: { id: "ord-1" },
      });
      expect(wrapper.find(".as-row-actions-more").exists()).toBe(true);
    });

    it("gates navigate-processor actions by $actions like any server action", () => {
      // editNav (navigate, in $actions) + ship (backend, not in $actions) →
      // only edit survives the filter, collapsing to the single-action slot —
      // rendered as a real anchor since navigate actions link when possible.
      const { wrapper } = setup({
        rowActions: [editNav, ship],
        row: { id: "ord-1", $actions: ["edit"] },
      });
      const links = wrapper.findAll("a.as-row-actions-btn");
      expect(links).toHaveLength(1);
      expect(links[0]!.attributes("aria-label")).toBe("Edit");
    });

    it("filters a navigate action absent from $actions", () => {
      const { wrapper } = setup({
        rowActions: [editNav],
        row: { id: "ord-1", $actions: [] }, // server gated edit out
      });
      expect(wrapper.findAll("button")).toHaveLength(0);
    });

    it("gates custom-processor actions by $actions like any server action", () => {
      // exportCsv (custom, in $actions) + ship (backend, not in $actions) →
      // only export survives, collapsing to a single labelled button.
      const { wrapper } = setup({
        rowActions: [exportCsv, ship],
        row: { id: "ord-1", $actions: ["export"] },
      });
      const buttons = wrapper.findAll("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0]!.attributes("aria-label")).toBe("Export");
    });

    it("filters a custom action absent from $actions", () => {
      const { wrapper } = setup({
        rowActions: [exportCsv],
        row: { id: "ord-1", $actions: [] }, // server gated export out
      });
      expect(wrapper.findAll("button")).toHaveLength(0);
    });

    it("__remove (synthetic) is exempt from $actions gating", () => {
      const { state } = setup({
        rowDelete: true,
        canRemove: true,
        row: { id: "ord-1", $actions: [] },
      });
      // Server doesn't know about __remove — UI keeps it regardless.
      expect(state.actions.row.find((a) => a.name === "__remove")).toBeDefined();
    });
  });

  // ── promptText tuple + $1 / $N substitution ─────────────────────────────

  describe("promptText tuple + $1/$N substitution", () => {
    it("substitutes $1 with preferredId values from the row", async () => {
      const promptAction: TDbActionInfo = {
        ...block,
        promptText: "Block $1?",
      };
      const { wrapper, state } = setup({
        rowActions: [promptAction],
        pk: { id: "alice" },
      });
      await wrapper.find("button").trigger("click");
      expect(state.confirmRequest.value?.message).toBe("Block alice?");
      state.dismissPrompt();
    });

    it("picks the singular tuple form for a single-row context", async () => {
      const promptAction: TDbActionInfo = {
        ...block,
        promptText: ["Block user $1?", "Block $N users?"],
      };
      const { wrapper, state } = setup({
        rowActions: [promptAction],
        pk: { id: "alice" },
      });
      await wrapper.find("button").trigger("click");
      expect(state.confirmRequest.value?.message).toBe("Block user alice?");
      state.dismissPrompt();
    });

    it("synthesised __remove default uses the tuple-form prompt", async () => {
      const { wrapper, state } = setup({
        rowDelete: true,
        canRemove: true,
        pk: { id: "ord-7" },
      });
      await wrapper.find("button").trigger("click");
      expect(state.confirmRequest.value?.message).toBe("Delete item ord-7?");
      state.dismissPrompt();
    });
  });

  // ── navigate actions rendered as real links ─────────────────────────────

  describe("navigate actions as anchors", () => {
    const editNav: TDbActionInfo = {
      name: "edit",
      label: "Edit",
      level: "row",
      processor: "navigate",
      value: "/orders/$1/edit",
      icon: "i-as-edit",
    };

    function clickEvent(init: MouseEventInit = {}) {
      return new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
    }

    it("renders an anchor with the interpolated, resolveHref-mapped href", () => {
      const { wrapper } = setup({
        rowActions: [editNav],
        pk: { id: "ord-1" },
        resolveHref: (url) => `/base${url}`,
      });
      expect(wrapper.findAll("button")).toHaveLength(0);
      const a = wrapper.find("a.as-row-actions-btn");
      expect(a.exists()).toBe(true);
      expect(a.attributes("href")).toBe("/base/orders/ord-1/edit");
      expect(a.attributes("aria-label")).toBe("Edit");
    });

    it("plain left click on the anchor prevents default and routes through invoke once", async () => {
      const { wrapper, actionFn } = setup({ rowActions: [editNav], pk: { id: "ord-1" } });
      const ev = clickEvent();
      wrapper.find("a").element.dispatchEvent(ev);
      await flushPromises();
      expect(ev.defaultPrevented).toBe(true);
      expect(actionFn).toHaveBeenCalledTimes(1);
      expect(actionFn).toHaveBeenCalledWith("edit", { id: "ord-1" });
    });

    it("cmd/ctrl/middle clicks on the anchor stay native — no invoke, default not prevented", async () => {
      const { wrapper, actionFn } = setup({ rowActions: [editNav], pk: { id: "ord-1" } });
      const el = wrapper.find("a").element;
      for (const init of [
        { metaKey: true },
        { ctrlKey: true },
        { button: 1 },
      ] satisfies MouseEventInit[]) {
        const ev = clickEvent(init);
        el.dispatchEvent(ev);
        await flushPromises();
        expect(ev.defaultPrevented).toBe(false);
      }
      expect(actionFn).not.toHaveBeenCalled();
    });

    it("promptText navigate stays a button; mod-click confirms then window.open, no invoke", async () => {
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
      const confirmNav: TDbActionInfo = { ...editNav, promptText: "Open $1?" };
      const { wrapper, state, actionFn } = setup({
        rowActions: [confirmNav],
        pk: { id: "ord-1" },
        resolveHref: (url) => `/base${url}`,
      });
      expect(wrapper.find("a").exists()).toBe(false);
      const btn = wrapper.find("button");
      await btn.trigger("click", { ctrlKey: true, button: 0 });
      expect(state.confirmRequest.value?.message).toBe("Open ord-1?");
      state.acceptPrompt();
      await flushPromises();
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledWith(
        "/base/orders/ord-1/edit",
        "_blank",
        "noopener,noreferrer",
      );
      expect(actionFn).not.toHaveBeenCalled();
    });

    it("promptText navigate: middle-click (auxclick) confirms then window.open; decline does nothing", async () => {
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
      const confirmNav: TDbActionInfo = { ...editNav, promptText: "Open?" };
      const { wrapper, state, actionFn } = setup({
        rowActions: [confirmNav],
        pk: { id: "ord-1" },
      });
      const btn = wrapper.find("button");

      await btn.trigger("auxclick", { button: 1 });
      expect(state.confirmRequest.value?.message).toBe("Open?");
      state.dismissPrompt();
      await flushPromises();
      expect(openSpy).not.toHaveBeenCalled();

      await btn.trigger("auxclick", { button: 1 });
      state.acceptPrompt();
      await flushPromises();
      expect(openSpy).toHaveBeenCalledWith("/orders/ord-1/edit", "_blank", "noopener,noreferrer");
      expect(actionFn).not.toHaveBeenCalled();
    });

    it("promptText navigate: plain click keeps today's confirm → invoke path", async () => {
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
      const confirmNav: TDbActionInfo = { ...editNav, promptText: "Open?" };
      const { wrapper, state, actionFn } = setup({
        rowActions: [confirmNav],
        pk: { id: "ord-1" },
      });
      await wrapper.find("button").trigger("click");
      state.acceptPrompt();
      await flushPromises();
      expect(actionFn).toHaveBeenCalledWith("edit", { id: "ord-1" });
      expect(openSpy).not.toHaveBeenCalled();
    });

    it("navigate with inputForm falls back to a plain button", () => {
      const { wrapper } = setup({
        rowActions: [{ ...editNav, inputForm: "EditForm" }],
        pk: { id: "ord-1" },
      });
      expect(wrapper.find("a").exists()).toBe(false);
      expect(wrapper.find("button.as-row-actions-btn").exists()).toBe(true);
    });

    it("navigate without a computable pk falls back to a plain button", () => {
      const { wrapper } = setup({ rowActions: [editNav], noPk: true });
      expect(wrapper.find("a").exists()).toBe(false);
      expect(wrapper.find("button.as-row-actions-btn").exists()).toBe(true);
    });
  });

  // ── navigate actions inside the `…` dropdown ────────────────────────────

  describe("navigate actions in the dropdown menu", () => {
    const editNav: TDbActionInfo = {
      name: "edit",
      label: "Edit",
      level: "row",
      processor: "navigate",
      value: "/orders/$1/edit",
    };

    async function openMenu(wrapper: ReturnType<typeof setup>["wrapper"]) {
      const trigger = wrapper.find("button.as-row-actions-more");
      await trigger.trigger("pointerdown", { button: 0, pointerType: "mouse" });
      await trigger.trigger("click");
      await flushPromises();
      return document.body.querySelectorAll('[role="menuitem"]');
    }

    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("navigate item without promptText renders as an anchor with the mapped href", async () => {
      const { wrapper } = setup({
        rowActions: [editNav, block],
        pk: { id: "ord-1" },
        resolveHref: (url) => `/base${url}`,
      });
      const items = await openMenu(wrapper);
      expect(items.length).toBe(2);
      const anchor = Array.from(items).find((el) => el.tagName === "A");
      expect(anchor).toBeDefined();
      expect(anchor!.getAttribute("href")).toBe("/base/orders/ord-1/edit");
      // The backend action stays a non-anchor item.
      expect(Array.from(items).some((el) => el.tagName !== "A")).toBe(true);
    });

    it("keyboard select on the anchor item still invokes", async () => {
      const { wrapper, actionFn } = setup({
        rowActions: [editNav, block],
        pk: { id: "ord-1" },
      });
      const items = await openMenu(wrapper);
      const anchor = Array.from(items).find((el) => el.tagName === "A")!;
      anchor.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      await flushPromises();
      expect(actionFn).toHaveBeenCalledTimes(1);
      expect(actionFn).toHaveBeenCalledWith("edit", { id: "ord-1" });
    });

    it("plain left click on the anchor item prevents default and invokes", async () => {
      const { wrapper, actionFn } = setup({
        rowActions: [editNav, block],
        pk: { id: "ord-1" },
      });
      const items = await openMenu(wrapper);
      const anchor = Array.from(items).find((el) => el.tagName === "A")!;
      anchor.dispatchEvent(
        new PointerEvent("pointerdown", { button: 0, bubbles: true, cancelable: true }),
      );
      const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
      anchor.dispatchEvent(ev);
      await flushPromises();
      expect(ev.defaultPrevented).toBe(true);
      expect(actionFn).toHaveBeenCalledWith("edit", { id: "ord-1" });
    });

    it("cmd-click on the anchor item skips invoke and keeps native default", async () => {
      const { wrapper, actionFn } = setup({
        rowActions: [editNav, block],
        pk: { id: "ord-1" },
      });
      const items = await openMenu(wrapper);
      const anchor = Array.from(items).find((el) => el.tagName === "A")!;
      anchor.dispatchEvent(
        new PointerEvent("pointerdown", {
          button: 0,
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      const ev = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        metaKey: true,
      });
      anchor.dispatchEvent(ev);
      await flushPromises();
      expect(ev.defaultPrevented).toBe(false);
      expect(actionFn).not.toHaveBeenCalled();
    });

    it("promptText navigate item stays non-anchor; middle-click confirms then window.open", async () => {
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
      const confirmNav: TDbActionInfo = { ...editNav, promptText: "Open?" };
      const { wrapper, state, actionFn } = setup({
        rowActions: [confirmNav, block],
        pk: { id: "ord-1" },
      });
      const items = await openMenu(wrapper);
      const item = Array.from(items).find((el) => el.textContent?.includes("Edit"))!;
      expect(item.tagName).not.toBe("A");
      item.dispatchEvent(
        new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }),
      );
      expect(state.confirmRequest.value?.message).toBe("Open?");
      state.acceptPrompt();
      await flushPromises();
      expect(openSpy).toHaveBeenCalledWith("/orders/ord-1/edit", "_blank", "noopener,noreferrer");
      expect(actionFn).not.toHaveBeenCalled();
    });
  });
});
