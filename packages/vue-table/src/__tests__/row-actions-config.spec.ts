// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import type { TDbActionInfo } from "@atscript/db-client";
import AsRowActions from "../components/defaults/as-row-actions.vue";
import AsTableActions from "../components/as-table-actions.vue";
import type { RowActionsConfig, TVueTableActionInfo } from "../types";
import { mockColumn, mountWithTableContext } from "./helpers";

function action(name: string, extra: Partial<TDbActionInfo> = {}): TDbActionInfo {
  return {
    name,
    label: name.toUpperCase(),
    level: "row",
    processor: "backend",
    value: `/x/${name}`,
    icon: `i-as-${name}`,
    ...extra,
  };
}

const serverActions = [action("block"), action("approve"), action("archive")];

// Reka portals render into `document.body` and survive the wrapper, so a menu
// left open by one test would be counted by the next.
afterEach(() => {
  document.body.innerHTML = "";
});

function setup(opts: {
  rowActions?: RowActionsConfig;
  row?: Record<string, unknown>;
  actionsProp?: TVueTableActionInfo[];
  resolveHref?: (url: string) => string;
}) {
  return mountWithTableContext(AsRowActions, {
    columns: [mockColumn("id")],
    props: { row: opts.row ?? { id: 1 }, actions: opts.actionsProp },
    decorateDef: (def) => {
      def.actions = { ...def.actions, row: serverActions };
    },
    onReady: (state) => {
      state.rowActions.value = opts.rowActions;
      if (opts.resolveHref) {
        (state as { resolveHref: (u: string) => string }).resolveHref = opts.resolveHref;
      }
    },
  });
}

/** Menu-item labels rendered inside the open dropdown. */
async function openMenu(wrapper: ReturnType<typeof setup>["wrapper"]) {
  await wrapper.find("button.as-row-actions-more").trigger("click");
  await flushPromises();
  return Array.from(document.querySelectorAll(".as-row-actions-menu-item"), (el) =>
    (el.textContent ?? "").trim(),
  );
}

describe("<AsRowActions> row-action policy", () => {
  it("shows every server action when no policy is configured", async () => {
    const { wrapper } = setup({});
    await flushPromises();
    expect(await openMenu(wrapper)).toEqual(["BLOCK", "APPROVE", "ARCHIVE"]);
  });

  it("narrows with include and exclude", async () => {
    const { wrapper } = setup({
      rowActions: { include: ["block", "approve"], exclude: ["approve"] },
    });
    await flushPromises();
    // include leaves {block, approve}; exclude then drops approve → one action
    // renders as the single-button form, not a menu.
    expect(wrapper.find("button.as-row-actions-more").exists()).toBe(false);
    expect(wrapper.find(".as-row-actions-btn").attributes("aria-label")).toBe("BLOCK");
  });

  it("applies presentation overrides without touching the rest", async () => {
    const { wrapper } = setup({
      rowActions: { overrides: { block: { label: "Suspend" } } },
    });
    await flushPromises();
    expect(await openMenu(wrapper)).toEqual(["Suspend", "APPROVE", "ARCHIVE"]);
  });

  it("cannot resurrect an action the server gated away for the row", async () => {
    const { wrapper } = setup({
      row: { id: 1, $actions: ["approve"] },
      rowActions: {
        include: ["block", "approve"],
        overrides: { block: { label: "Suspend" } },
      },
    });
    await flushPromises();
    expect(wrapper.find("button.as-row-actions-more").exists()).toBe(false);
    expect(wrapper.find(".as-row-actions-btn").attributes("aria-label")).toBe("APPROVE");
  });

  it("appends client-only extra actions, gated by their own enabled()", async () => {
    const { wrapper } = setup({
      rowActions: {
        include: ["block"],
        extra: [
          { name: "audit", label: "Audit", onInvoke: () => {} },
          { name: "hidden", label: "Hidden", enabled: () => false, onInvoke: () => {} },
        ],
      },
    });
    await flushPromises();
    expect(await openMenu(wrapper)).toEqual(["BLOCK", "Audit"]);
  });

  it("renders an extra action's href as a real anchor through resolveHref", async () => {
    const { wrapper } = setup({
      row: { id: 7 },
      resolveHref: (u) => `/app${u}`,
      rowActions: {
        include: [],
        extra: [{ name: "open", label: "Open", href: (row) => `/orders/${String(row.id)}` }],
      },
    });
    await flushPromises();
    const anchor = wrapper.find("a.as-row-actions-btn");
    expect(anchor.exists()).toBe(true);
    expect(anchor.attributes("href")).toBe("/app/orders/7");
  });

  it("runs onInvoke locally and settles as a custom @action result", async () => {
    const onInvoke = vi.fn();
    const resolved: unknown[] = [];
    const { wrapper, state } = mountWithTableContext(AsRowActions, {
      columns: [mockColumn("id")],
      props: { row: { id: 42 } },
      onReady: (s) => {
        s.rowActions.value = {
          extra: [{ name: "audit", label: "Audit", onInvoke }],
        };
      },
    });
    await flushPromises();
    const spy = vi.spyOn(state.actions, "invoke");
    await wrapper.find(".as-row-actions-btn").trigger("click");
    await flushPromises();

    expect(onInvoke).toHaveBeenCalledWith({ id: 42 }, { id: 42 });
    const result = await spy.mock.results[0]!.value;
    expect(result).toMatchObject({ ok: true, kind: "custom" });
    expect(resolved).toEqual([]);
  });

  it("include: [] hides every server action while extras survive", async () => {
    const { wrapper } = setup({
      rowActions: {
        include: [],
        extra: [{ name: "audit", label: "Audit", onInvoke: () => {} }],
      },
    });
    await flushPromises();
    expect(wrapper.find("button.as-row-actions-more").exists()).toBe(false);
    expect(wrapper.find(".as-row-actions-btn").attributes("aria-label")).toBe("Audit");
  });

  it("an explicit :actions prop bypasses the context policy", async () => {
    const { wrapper } = setup({
      rowActions: { include: ["block"] },
      actionsProp: [action("only") as TVueTableActionInfo],
    });
    await flushPromises();
    expect(wrapper.find(".as-row-actions-btn").attributes("aria-label")).toBe("ONLY");
  });
});

describe("<AsTableActions> reads the same policy", () => {
  function toolbar(rowActions: RowActionsConfig) {
    return mountWithTableContext(AsTableActions, {
      columns: [mockColumn("id")],
      props: { level: "auto" },
      decorateDef: (def) => {
        def.actions = { ...def.actions, row: serverActions };
      },
      onReady: (state) => {
        state.rowActions.value = rowActions;
        state.selectedRows.value = [{ id: 1 }];
      },
    });
  }

  /** Labels rendered inside the toolbar's open `…` menu. */
  async function openMenu(wrapper: ReturnType<typeof toolbar>["wrapper"]) {
    await wrapper.find("button.as-table-actions-more").trigger("click");
    await flushPromises();
    return Array.from(document.querySelectorAll(".as-table-actions-menu-item"), (el) =>
      (el.textContent ?? "").trim(),
    );
  }

  it("excludes, relabels and appends exactly like the row cell", async () => {
    const { wrapper } = toolbar({
      exclude: ["archive"],
      overrides: { block: { label: "Suspend" } },
      extra: [{ name: "audit", label: "Audit", onInvoke: () => {} }],
    });
    await flushPromises();
    const labels = await openMenu(wrapper);
    expect(labels).toEqual(["Suspend", "APPROVE", "Audit"]);
  });

  it("still cannot show an action the server gated away for the row", async () => {
    const { wrapper } = mountWithTableContext(AsTableActions, {
      columns: [mockColumn("id")],
      props: { level: "auto" },
      decorateDef: (def) => {
        def.actions = { ...def.actions, row: serverActions };
      },
      onReady: (state) => {
        state.rowActions.value = { overrides: { block: { label: "Suspend" } } };
        state.selectedRows.value = [{ id: 1, $actions: ["approve"] }];
      },
    });
    await flushPromises();
    expect(wrapper.find("button.as-table-actions-more").exists()).toBe(false);
    expect(wrapper.find(".as-table-actions-btn").text()).toContain("APPROVE");
  });
});
