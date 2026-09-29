// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import type { TDbActionInfo } from "@atscript/db-client";
import AsRowActions from "../components/defaults/as-row-actions.vue";
import AsTableActions from "../components/as-table-actions.vue";
import {
  compileRowActionsConfig,
  resolveRowActions,
} from "../composables/state/row-actions-config";
import type { ReactiveTableState, RowActionsConfig, TVueTableActionInfo } from "../types";
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

  it("a string from enabled(row) keeps the extra action, disabled with that reason", async () => {
    const { wrapper } = setup({
      rowActions: {
        include: ["block"],
        extra: [
          { name: "audit", label: "Audit", onInvoke: () => {}, enabled: () => "No history yet" },
          { name: "blank", label: "Blank", onInvoke: () => {}, enabled: () => "" },
        ],
      },
    });
    await flushPromises();
    // `""` is not a reason — it enables, like the server's verdict.
    expect(await openMenu(wrapper)).toEqual(["BLOCK", "AuditNo history yet", "Blank"]);
    const audit = document.querySelector('[aria-label="Audit, No history yet"]');
    expect(audit?.getAttribute("aria-disabled")).toBe("true");
  });

  it("a disabled extra href action renders a button, not an anchor", async () => {
    const { wrapper } = setup({
      row: { id: 7 },
      rowActions: {
        include: [],
        extra: [
          {
            name: "open",
            label: "Open",
            href: (row) => `/orders/${String(row.id)}`,
            enabled: () => "Draft orders have no page",
          },
        ],
      },
    });
    await flushPromises();
    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.find("button.as-row-actions-btn").attributes("aria-disabled")).toBe("true");
  });

  it("include / exclude narrow disabled-with-reason server actions too", async () => {
    const row = {
      id: 1,
      $actions: ["approve"],
      $disabledReasons: { block: "Already blocked", archive: "Locked" },
    };
    const { wrapper } = setup({ row, rowActions: { exclude: ["archive"] } });
    await flushPromises();
    expect(await openMenu(wrapper)).toEqual(["BLOCKAlready blocked", "APPROVE"]);
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

describe("resolveRowActions — the shared per-row pipeline", () => {
  const [block, approve, archive] = serverActions as TVueTableActionInfo[];
  const bulk = { ...action("purge"), level: "rows" } as TVueTableActionInfo;

  function fakeState(config?: RowActionsConfig) {
    return {
      rowActionsPolicy: { value: compileRowActionsConfig(config) },
      actions: {
        default: { row: block },
        others: { row: [approve, archive] },
        rows: [bulk],
      },
    } as unknown as ReactiveTableState;
  }

  it("gates, narrows and relabels in one pass; the server verdict comes first", () => {
    const out = resolveRowActions(
      fakeState({ exclude: ["archive"], overrides: { block: { label: "Suspend" } } }),
      { id: 1, $actions: ["approve", "archive"], $disabledReasons: { block: "Already blocked" } },
    );
    // Disabled by the server, relabelled by the policy — the reason survives.
    expect(out.default).toMatchObject({
      name: "block",
      label: "Suspend",
      disabledReason: "Already blocked",
    });
    expect(out.others).toEqual([approve]);
    // Not in `$actions`, no reason → hidden.
    expect(out.rows).toEqual([]);
  });

  it("an excluded action stays hidden even when the server gives a reason", () => {
    const out = resolveRowActions(fakeState({ exclude: ["block"] }), {
      $actions: [],
      $disabledReasons: { block: "Already blocked" },
    });
    expect(out.default).toBeUndefined();
  });

  it("returns the source arrays untouched when nothing applies", () => {
    const state = fakeState();
    const out = resolveRowActions(state, { id: 1 });
    expect(out.default).toBe(block);
    expect(out.others).toBe(state.actions.others.row);
    expect(out.rows).toBe(state.actions.rows);
  });

  it("withRows: false leaves the rows-level bucket out", () => {
    expect(resolveRowActions(fakeState(), { id: 1 }, { withRows: false }).rows).toEqual([]);
  });

  it("extra: descriptors built once; enabled(row) verdicts gate them per row", () => {
    const state = fakeState({
      extra: [
        { name: "audit", label: "Audit", enabled: (r) => (r.locked ? "Locked" : true) },
        { name: "notes", label: "Notes", enabled: (r) => !r.hidden },
      ],
    });
    const open = resolveRowActions(state, { id: 1 }).extra;
    expect(resolveRowActions(state, { id: 2 }).extra).toBe(open);
    const locked = resolveRowActions(state, { id: 3, locked: true, hidden: true }).extra;
    expect(locked).toEqual([{ ...open[0], disabledReason: "Locked" }]);
  });
});
