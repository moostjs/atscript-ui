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
  defaultRow?: TDbActionInfo;
  rowDelete?: boolean;
  canRemove?: boolean;
  pk?: unknown;
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
        },
      });
      state = s;
      // `rowDelete` is renderer-owned: `<AsTable>` / `<AsWindowTable>` push
      // their `:row-delete` prop into `state.rowDelete.value` via watchers.
      // Tests bypass the renderer and write directly.
      state.rowDelete.value = opts.rowDelete ?? false;
      const def = mockTableDef([mockColumn("id"), mockColumn("name")]);
      if (opts.canRemove !== undefined) def.canRemove = opts.canRemove;
      if (opts.rowActions) {
        def.actions = {
          ...def.actions,
          row: opts.rowActions,
          default: { ...def.actions.default, row: opts.defaultRow },
        };
      }
      internals.init(def);
      provideTableContext({ state, client, controls: {} });
      return () => h(AsRowActions, { pk: opts.pk ?? "user-1" });
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

  it("click invokes state.actions.invoke with row PK", async () => {
    const { wrapper, actionFn } = setup({ rowActions: [block], pk: "user-42" });
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(actionFn).toHaveBeenCalledWith("block", "user-42");
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
    const { wrapper, state, actionFn } = setup({ rowActions: [promptAction], pk: "x" });
    await wrapper.find("button").trigger("click");
    expect(state.confirmRequest.value?.message).toBe("Really?");
    state.acceptPrompt();
    await flushPromises();
    expect(actionFn).toHaveBeenCalledWith("block", "x");
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
});
