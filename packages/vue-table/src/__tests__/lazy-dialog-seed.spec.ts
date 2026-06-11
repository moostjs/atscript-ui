// @vitest-environment happy-dom
//
// Regression — `<AsTableRoot>` lazy-mounts the filter / config / preset
// dialogs behind `everOpened*` latches, so on the no-`:controls` path a
// dialog's component mounts AFTER its open state is already truthy. Each
// dialog seeds its draft model in a watcher on that open state; without
// `immediate: true` the false→true transition is never observed by a
// post-open mount and the dialog renders empty (e.g. zero `.as-filter-input`
// condition rows). The dialog's displayed rows must be derivable from state
// at any mount time.
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import AsTableRoot from "../components/as-table-root.vue";
import { clearTableCache } from "../composables/use-table";
import type { ReactiveTableState } from "../types";
import { createMockClient, createMockMeta } from "./helpers";

afterEach(() => {
  clearTableCache();
  document.body.innerHTML = "";
});

async function mountRoot(url: string) {
  const meta = createMockMeta(["id", "name"]);
  const { client } = createMockClient({ meta, data: [{ id: "1", name: "Ann" }] });
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          AsTableRoot as unknown as Parameters<typeof h>[0],
          { url, clientFactory: () => client },
          { default: () => [] },
        );
    },
  });
  const wrapper = mount(Host, { attachTo: document.body });
  // Let meta + first query settle so columns exist before any dialog opens.
  await flushPromises();
  await flushPromises();
  const root = wrapper.findComponent(AsTableRoot as unknown as never) as unknown as {
    vm: { state: ReactiveTableState };
  };
  return { wrapper, state: root.vm.state };
}

/** Latch watcher flush → async chunk resolve → dialog mount + portal. */
async function settleLazyDialog() {
  await flushPromises();
  await flushPromises();
  await flushPromises();
  await nextTick();
}

describe("lazy dialog mount — open state set before the async component resolves", () => {
  it("filter dialog seeds the initial condition row for the target column", async () => {
    const { wrapper, state } = await mountRoot("/lazy-filter-seed");
    const column = state.allColumns.value.find((c) => c.path === "name");
    expect(column).toBeDefined();

    // Open BEFORE the lazy chunk is even requested — the `everOpenedFilter`
    // latch only mounts the async component in reaction to this write.
    state.openFilterDialog(column!);
    await settleLazyDialog();

    const dialog = document.body.querySelector(".as-filter-dialog-content");
    expect(dialog).not.toBeNull();
    // The auto-seeded empty condition row for the target column must exist
    // even though the dialog mounted with `filterDialogColumn` already set.
    expect(dialog!.querySelectorAll(".as-filter-condition-row")).toHaveLength(1);
    expect(dialog!.querySelector(".as-filter-input")).not.toBeNull();
    wrapper.unmount();
  });

  it("config dialog snapshots current columns into its draft models", async () => {
    const { wrapper, state } = await mountRoot("/lazy-config-seed");

    state.showConfigDialog();
    await settleLazyDialog();

    const dialog = document.body.querySelector(".as-config-dialog-content");
    expect(dialog).not.toBeNull();
    // Tab counts render the draft model lengths — a post-open mount that
    // misses the open transition would show 0 columns instead of 2.
    const counts = dialog!.querySelectorAll(".as-config-tabs-list .as-config-tab-count");
    expect(counts.length).toBeGreaterThan(0);
    expect(counts[0]!.textContent!.trim()).toBe("2");
    wrapper.unmount();
  });
});
