// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, type VNode } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { MetaResponse } from "@atscript/ui";
import AsTableRoot from "../components/as-table-root.vue";
import AsTable from "../components/as-table.vue";
import AsFilters from "../components/as-filters.vue";
import { clearTableCache } from "../composables/use-table";
import { createDefaultControls } from "../composables/create-default-controls";
import type { TAsCellTypeComponents, TAsTableControls } from "../types";
import { createMockClient, createMockMeta } from "./helpers";

afterEach(() => {
  clearTableCache();
});

const rowAction: MetaResponse["actions"][number] = {
  name: "block",
  label: "Block",
  level: "row",
  processor: "backend",
  value: "/x/block",
  icon: "i-as-block",
};

const CustomHeaderCell = defineComponent({
  props: { column: { type: Object, required: true } },
  setup: (props) => () => h("span", { class: "custom-header-cell" }, String(props.column.label)),
});

const CustomRowActions = defineComponent({
  props: { row: { type: Object, required: true }, column: { type: Object, required: true } },
  setup: () => () => h("td", { class: "custom-row-actions" }),
});

const TypesRowActions = defineComponent({
  props: { row: { type: Object, required: true }, column: { type: Object, required: true } },
  setup: () => () => h("td", { class: "types-row-actions" }),
});

const CustomFilterField = defineComponent({
  props: { column: { type: Object, required: true } },
  setup: (props) => () => h("div", { class: "custom-filter-field" }, String(props.column.label)),
});

function mountRoot(opts: {
  url: string;
  controls?: TAsTableControls;
  types?: Partial<TAsCellTypeComponents>;
  actions?: MetaResponse["actions"];
  child: () => VNode | VNode[];
}) {
  const meta = createMockMeta(["id", "name"], { actions: opts.actions });
  const { client } = createMockClient({ meta, data: [{ id: "1", name: "Ann" }] });
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          AsTableRoot as unknown as Parameters<typeof h>[0],
          {
            url: opts.url,
            clientFactory: () => client,
            controls: opts.controls,
            types: opts.types,
          },
          { default: opts.child },
        );
    },
  });
  return mount(Host);
}

describe(":controls dispatch — context-provided chrome overrides", () => {
  it("controls.headerCell replaces the default header cell", async () => {
    const wrapper = mountRoot({
      url: "/ctl-header",
      controls: { headerCell: CustomHeaderCell },
      child: () => h(AsTable),
    });
    await flushPromises();
    await flushPromises();
    const custom = wrapper.findAll("thead .custom-header-cell");
    expect(custom.length).toBe(2); // id + name columns
    expect(custom[0]!.text()).toBe("id");
    expect(wrapper.find("thead .as-th-btn").exists()).toBe(false);
  });

  it("controls.rowActions replaces the __actions cell renderer", async () => {
    const wrapper = mountRoot({
      url: "/ctl-row-actions",
      controls: { rowActions: CustomRowActions },
      actions: [rowAction],
      child: () => h(AsTable, { rowActionsColumn: "first" }),
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("tbody td.custom-row-actions").exists()).toBe(true);
    expect(wrapper.find("tbody td.as-row-actions").exists()).toBe(false);
  });

  it("__actions cell falls back to the built-in AsRowActions without controls", async () => {
    const wrapper = mountRoot({
      url: "/ctl-row-actions-default",
      actions: [rowAction],
      child: () => h(AsTable, { rowActionsColumn: "first" }),
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("tbody td.as-row-actions").exists()).toBe(true);
  });

  it("__actions cell falls back to types.__actions when no controls.rowActions is set", async () => {
    const wrapper = mountRoot({
      url: "/ctl-row-actions-types",
      types: { __actions: TypesRowActions },
      actions: [rowAction],
      child: () => h(AsTable, { rowActionsColumn: "first" }),
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("tbody td.types-row-actions").exists()).toBe(true);
    expect(wrapper.find("tbody td.as-row-actions").exists()).toBe(false);
  });

  it("controls.rowActions wins over types.__actions", async () => {
    const wrapper = mountRoot({
      url: "/ctl-row-actions-precedence",
      controls: { rowActions: CustomRowActions },
      types: { __actions: TypesRowActions },
      actions: [rowAction],
      child: () => h(AsTable, { rowActionsColumn: "first" }),
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("tbody td.custom-row-actions").exists()).toBe(true);
    expect(wrapper.find("tbody td.types-row-actions").exists()).toBe(false);
  });

  it("createDefaultControls() does not shadow a custom types.__actions (rowActions not seeded)", async () => {
    const wrapper = mountRoot({
      url: "/ctl-row-actions-no-shadow",
      controls: createDefaultControls(),
      types: { __actions: TypesRowActions },
      actions: [rowAction],
      child: () => h(AsTable, { rowActionsColumn: "first" }),
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find("tbody td.types-row-actions").exists()).toBe(true);
    expect(wrapper.find("tbody td.as-row-actions").exists()).toBe(false);
  });

  it("controls.filterField replaces the per-field filter renderer in <AsFilters>", async () => {
    const wrapper = mountRoot({
      url: "/ctl-filter-field",
      controls: { filterField: CustomFilterField },
      child: () => h(AsFilters, { filterFields: ["name"] }),
    });
    await flushPromises();
    await flushPromises();
    const custom = wrapper.find(".custom-filter-field");
    expect(custom.exists()).toBe(true);
    expect(custom.text()).toBe("name");
    expect(wrapper.find(".as-filter-field").exists()).toBe(false);
  });
});
