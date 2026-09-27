// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, type mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref, watch } from "vue";
import type { ColumnDef } from "@atscript/ui";
import { useTableContext } from "../composables/use-table-state";
import AsFilters from "../components/as-filters.vue";
import { mockColumn, mountWithTableContext } from "./helpers";

const PATHS = ["name", "status", "owner", "region"];

// Popovers portal to `document.body`; unmount so none outlives its test.
enableAutoUnmount(afterEach);

function setup(props: Record<string, unknown> = {}) {
  return mountWithTableContext(AsFilters, {
    columns: PATHS.map((p) => mockColumn(p)),
    props: { filterFields: PATHS, ...props },
  });
}

/**
 * Column paths of the filter fields rendered inline. The overflow popover is
 * portaled to `document.body`, so anything inside the wrapper is inline.
 */
function inlinePaths(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper
    .findAll(".as-filter-field")
    .map((f) => f.attributes("data-column-path") ?? f.text());
}

describe("<AsFilters> — overflow", () => {
  it("renders every field inline and no trigger when maxVisible is omitted", () => {
    const { wrapper } = setup();
    expect(inlinePaths(wrapper)).toHaveLength(PATHS.length);
    expect(wrapper.find(".as-filters-overflow-trigger").exists()).toBe(false);
    // Multi-root fragment: no wrapper element of its own, so the fields are
    // direct children of whatever the host laid out.
    expect(wrapper.find(".as-filters").exists()).toBe(false);
  });

  it("with maxVisible=2 of 4 fields renders 2 inline plus the overflow trigger", () => {
    const { wrapper } = setup({ maxVisible: 2 });
    // 2 fields + the popover root (trigger).
    const trigger = wrapper.find(".as-filters-overflow-trigger");
    expect(trigger.exists()).toBe(true);
    expect(trigger.element.tagName).toBe("BUTTON");
    expect(trigger.attributes("aria-label")).toBe("More filters");
    expect(inlinePaths(wrapper)).toHaveLength(2);
  });

  it("badges only the ACTIVE overflow filters", async () => {
    const { wrapper, state } = setup({ maxVisible: 2 });
    // Nothing filtered yet.
    expect(wrapper.find(".as-filters-overflow-badge").exists()).toBe(false);

    // `name` is inline (index 0) → must NOT count; `owner` is overflowed.
    state.setFieldFilter("name", [{ op: "eq", value: "x" } as never]);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".as-filters-overflow-badge").exists()).toBe(false);

    state.setFieldFilter("owner", [{ op: "eq", value: "y" } as never]);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".as-filters-overflow-badge").text()).toBe("1");

    state.setFieldFilter("region", [{ op: "eq", value: "z" } as never]);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".as-filters-overflow-badge").text()).toBe("2");
  });

  it("the popover renders the remaining fields", async () => {
    const { wrapper } = setup({ maxVisible: 2 });
    expect(document.body.querySelector(".as-filters-overflow")).toBeNull();

    await wrapper.find(".as-filters-overflow-trigger").trigger("click");

    const panel = document.body.querySelector(".as-filters-overflow");
    expect(panel).not.toBeNull();
    expect(panel!.querySelectorAll(".as-filter-field")).toHaveLength(PATHS.length - 2);
  });

  it("overflow='none' drops the extra fields without a trigger", () => {
    const { wrapper } = setup({ maxVisible: 2, overflow: "none" });
    expect(inlinePaths(wrapper)).toHaveLength(2);
    expect(wrapper.find(".as-filters-overflow-trigger").exists()).toBe(false);
  });
});

const flush = async (n = 4) => {
  for (let i = 0; i < n; i++) {
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
  }
};
const panel = () => document.body.querySelector(".as-filters-overflow");

/** Host binding `v-model:overflow-open` to a ref it exposes. */
function setupControlled(extra: Record<string, unknown> = {}, slots?: Record<string, unknown>) {
  const open = ref(false);
  const Host = defineComponent({
    setup: () => () =>
      h(
        AsFilters,
        {
          filterFields: PATHS,
          maxVisible: 2,
          overflowOpen: open.value,
          "onUpdate:overflowOpen": (v: boolean) => (open.value = v),
          ...extra,
        },
        slots,
      ),
  });
  const mounted = mountWithTableContext(Host, { columns: PATHS.map((p) => mockColumn(p)) });
  return { ...mounted, open };
}

describe("<AsFilters> — overflow popover control", () => {
  it("v-model:overflow-open opens and closes the popover from the host", async () => {
    const { open } = setupControlled();
    expect(panel()).toBeNull();
    open.value = true;
    await flush();
    expect(panel()).not.toBeNull();
    open.value = false;
    await flush();
    expect(panel()).toBeNull();
  });

  it("the trigger updates the bound model", async () => {
    const { wrapper, open } = setupControlled();
    await wrapper.find(".as-filters-overflow-trigger").trigger("click");
    await flush();
    expect(open.value).toBe(true);
    expect(panel()).not.toBeNull();
  });

  it("forwards the popover's auto-focus events", async () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const { open } = setupControlled({
      onOverflowOpenAutoFocus: onOpen,
      onOverflowCloseAutoFocus: onClose,
    });
    open.value = true;
    await flush();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0]).toBeInstanceOf(Event);
    open.value = false;
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a prevented close-auto-focus keeps focus off the trigger", async () => {
    const { wrapper } = setupControlled({
      onOverflowCloseAutoFocus: (e: Event) => e.preventDefault(),
    });
    const trigger = wrapper.find<HTMLButtonElement>(".as-filters-overflow-trigger");
    await trigger.trigger("click");
    await flush();
    document.body.querySelector<HTMLInputElement>(".as-filters-overflow input")?.focus();
    await trigger.trigger("click");
    await flush();
    expect(panel()).toBeNull();
    expect(document.activeElement).not.toBe(trigger.element);
  });

  it("#overflow-trigger replaces the trigger and receives activeCount + open", async () => {
    const seen: Array<{ activeCount: number; open: boolean }> = [];
    const { wrapper, state, open } = setupControlled(
      {},
      {
        "overflow-trigger": (p: { activeCount: number; open: boolean }) => {
          seen.push({ ...p });
          return h("button", { type: "button", class: "host-trigger" }, `More (${p.activeCount})`);
        },
      },
    );
    expect(wrapper.find(".as-filters-overflow-trigger").exists()).toBe(false);
    state.setFieldFilter("owner", [{ type: "eq", value: ["y"] }]);
    await flush();
    const trigger = wrapper.find(".host-trigger");
    expect(trigger.text()).toBe("More (1)");
    // The popover's trigger wiring lands on the host's element.
    expect(trigger.attributes("aria-expanded")).toBe("false");
    await trigger.trigger("click");
    await flush();
    expect(open.value).toBe(true);
    expect(seen.at(-1)).toEqual({ activeCount: 1, open: true });
  });

  it("#overflow replaces the body with the overflowed columns and a close()", async () => {
    let close!: () => void;
    const { open } = setupControlled(
      {},
      {
        overflow: (p: { columns: ColumnDef[]; close: () => void }) => {
          close = p.close;
          return h("div", { class: "host-body" }, [
            h("button", { type: "button" }, p.columns.map((c) => c.path).join(",")),
          ]);
        },
      },
    );
    open.value = true;
    await flush();
    expect(panel()?.querySelector(".host-body")?.textContent).toBe("owner,region");
    expect(panel()?.querySelector(".as-filter-field")).toBeNull();
    close();
    await flush();
    expect(open.value).toBe(false);
  });

  it("host recipe: close the popover when a field opens the filter dialog", async () => {
    const open = ref(true);
    let ctx!: ReturnType<typeof useTableContext>;
    const Host = defineComponent({
      setup() {
        ctx = useTableContext();
        watch(
          () => ctx.state.filterDialogColumn.value,
          (c) => c && (open.value = false),
        );
        return () =>
          h(AsFilters, {
            filterFields: PATHS,
            maxVisible: 2,
            overflowOpen: open.value,
            "onUpdate:overflowOpen": (v: boolean) => (open.value = v),
          });
      },
    });
    mountWithTableContext(Host, { columns: PATHS.map((p) => mockColumn(p)) });
    await flush();
    expect(panel()).not.toBeNull();
    ctx.state.openFilterDialog(mockColumn("owner"));
    await flush();
    expect(open.value).toBe(false);
    expect(panel()).toBeNull();
  });

  it("does not reopen by itself after the overflow empties and comes back", async () => {
    const maxVisible = ref(2);
    const Host = defineComponent({
      setup: () => () => h(AsFilters, { filterFields: PATHS, maxVisible: maxVisible.value }),
    });
    const { wrapper } = mountWithTableContext(Host, { columns: PATHS.map((p) => mockColumn(p)) });
    await wrapper.find(".as-filters-overflow-trigger").trigger("click");
    await flush();
    expect(panel()).not.toBeNull();
    maxVisible.value = 10;
    await flush();
    expect(panel()).toBeNull();
    maxVisible.value = 2;
    await flush();
    expect(wrapper.find(".as-filters-overflow-trigger").exists()).toBe(true);
    expect(panel()).toBeNull();
  });
});
