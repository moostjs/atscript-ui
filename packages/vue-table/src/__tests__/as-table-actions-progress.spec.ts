// @vitest-environment happy-dom
//
// Regression — a running toolbar action was only signalled visually: no
// `aria-busy`, no accessible loading name, and no live region anywhere, so
// screen-reader users got no feedback that anything was happening (or that
// it had finished / failed).
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import type { TDbActionInfo } from "@atscript/db-client";
import AsTableActions from "../components/as-table-actions.vue";
import { mockColumn, mountWithTableContext, stubClient } from "./helpers";

const exportAction: TDbActionInfo = {
  name: "export",
  label: "Export",
  level: "table",
  processor: "backend",
  value: "/x/export",
};

/** Mount the toolbar with one table-level default action and a deferred `action()`. */
function setup() {
  let settle!: (ok: boolean) => void;
  const actionFn = vi.fn(
    () =>
      new Promise<unknown>((resolve, reject) => {
        settle = (ok) => (ok ? resolve({ ok: true }) : reject(new Error("boom")));
      }),
  );
  const { wrapper, state } = mountWithTableContext(AsTableActions, {
    columns: [mockColumn("id")],
    client: stubClient({ action: actionFn } as never),
    attachTo: false,
    decorateDef: (def) => {
      def.actions = { table: [exportAction], row: [], rows: [], default: { table: exportAction } };
    },
  });
  return { wrapper, state, settle: (ok: boolean) => settle(ok) };
}

function live(wrapper: { element: Element }): HTMLElement {
  const el = wrapper.element.querySelector<HTMLElement>("[role=status]");
  if (!el) throw new Error("live region not found");
  return el;
}

describe("<AsTableActions> progress feedback", () => {
  it("marks the running trigger aria-busy and suffixes its accessible name", async () => {
    const { wrapper, state, settle } = setup();
    const button = wrapper.element.querySelector("[data-default]") as HTMLElement;
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(button.getAttribute("aria-label")).toBe("Export");

    void state.actions.invoke(state.actions.default.table!);
    await nextTick();

    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Export, running");
    // The VISIBLE label is untouched.
    expect(button.querySelector(".as-table-actions-btn-label")?.textContent).toBe("Export");

    settle(true);
    await flushPromises();
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(button.getAttribute("aria-label")).toBe("Export");
  });

  it("announces start and completion in a polite live region", async () => {
    const { wrapper, state, settle } = setup();
    const region = live(wrapper);
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.className).toContain("sr-only");
    expect(region.textContent).toBe("");

    void state.actions.invoke(state.actions.default.table!);
    await nextTick();
    expect(region.textContent).toBe("Export running");

    settle(true);
    await flushPromises();
    expect(region.textContent).toBe("Export finished");
  });

  it("announces a failure", async () => {
    const { wrapper, state, settle } = setup();
    void state.actions.invoke(state.actions.default.table!);
    await nextTick();

    settle(false);
    await flushPromises();
    expect(live(wrapper).textContent).toBe("Export failed");
  });
});
