import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import {
  createTableState,
  provideTableContext,
  useTableContext,
  type TableStateInternals,
} from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import { createMockMeta, createMockClient, mockColumn, mockTableDef } from "./helpers";

describe("createTableState", () => {
  it("creates state with default values", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState());
          return () => h("div");
        },
      }),
    );

    expect(state.tableDef.value).toBeNull();
    expect(state.columns.value).toEqual([]);
    expect(state.allColumns.value).toEqual([]);
    expect(state.filters.value).toEqual({});
    expect(state.sorters.value).toEqual([]);
    expect(state.results.value).toEqual([]);
    expect(state.querying.value).toBe(false);
    expect(state.queryingNext.value).toBe(false);
    expect(state.totalCount.value).toBe(0);
    expect(state.loadedCount.value).toBe(0);
    expect(state.pagination.value).toEqual({ page: 1, itemsPerPage: 50 });
    expect(state.queryError.value).toBeNull();
    expect(state.metadataError.value).toBeNull();
    expect(state.mustRefresh.value).toBe(false);
    expect(state.searchTerm.value).toBe("");
    expect(state.configDialogOpen.value).toBe(false);
  });

  it("respects custom limit", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState({ limit: 25 }));
          return () => h("div");
        },
      }),
    );
    expect(state.pagination.value.itemsPerPage).toBe(25);
  });

  it("init populates tableDef and allColumns", () => {
    let state!: ReactiveTableState;
    let internals!: TableStateInternals;
    mount(
      defineComponent({
        setup() {
          ({ state, internals } = createTableState());
          return () => h("div");
        },
      }),
    );

    const cols = [mockColumn("name"), mockColumn("age"), mockColumn("hidden", { visible: false })];
    const def = mockTableDef(cols);

    internals.init(def);

    expect(state.tableDef.value).toBe(def);
    expect(state.allColumns.value).toEqual(cols);
    // columns is empty until columnNames is set (done by useTable)
    expect(state.columns.value).toEqual([]);
  });

  it("columns computed resolves from columnNames + allColumns", () => {
    let state!: ReactiveTableState;
    let internals!: TableStateInternals;
    mount(
      defineComponent({
        setup() {
          ({ state, internals } = createTableState());
          return () => h("div");
        },
      }),
    );

    const cols = [mockColumn("name"), mockColumn("age"), mockColumn("hidden", { visible: false })];
    internals.init(mockTableDef(cols));

    state.columnNames.value = ["name", "age"];
    expect(state.columns.value).toEqual([cols[0], cols[1]]);

    // Reorder
    state.columnNames.value = ["age", "name"];
    expect(state.columns.value).toEqual([cols[1], cols[0]]);

    // Unknown names are ignored
    state.columnNames.value = ["name", "nonexistent"];
    expect(state.columns.value).toEqual([cols[0]]);
  });

  it("addFilterField adds to filterFields (deduped)", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState());
          return () => h("div");
        },
      }),
    );

    state.addFilterField("name");
    expect(state.filterFields.value).toEqual(["name"]);

    state.addFilterField("age");
    expect(state.filterFields.value).toEqual(["name", "age"]);

    // Duplicate ignored
    state.addFilterField("name");
    expect(state.filterFields.value).toEqual(["name", "age"]);
  });

  it("removeFilterField removes from filterFields and preserves applied filter value", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState());
          return () => h("div");
        },
      }),
    );

    state.addFilterField("name");
    state.addFilterField("age");
    state.setFieldFilter("name", [{ type: "eq", value: ["test"] }]);

    state.removeFilterField("name");

    expect(state.filterFields.value).toEqual(["age"]);
    expect(state.filters.value.name).toEqual([{ type: "eq", value: ["test"] }]);
  });

  it("removeFieldFilter clears conditions but keeps filterFields", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState());
          return () => h("div");
        },
      }),
    );

    state.addFilterField("name");
    state.setFieldFilter("name", [{ type: "eq", value: ["test"] }]);

    state.removeFieldFilter("name");

    expect(state.filterFields.value).toEqual(["name"]);
    expect(state.filters.value.name).toBeUndefined();
  });

  it("resetFilters clears filters but keeps filterFields", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState());
          return () => h("div");
        },
      }),
    );

    state.addFilterField("name");
    state.setFieldFilter("name", [{ type: "eq", value: ["test"] }]);
    state.resetFilters();

    expect(state.filters.value).toEqual({});
    expect(state.filterFields.value).toEqual(["name"]);
  });

  it("showConfigDialog opens dialog and sets tab", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState());
          return () => h("div");
        },
      }),
    );

    expect(state.configDialogOpen.value).toBe(false);
    expect(state.configTab.value).toBe("columns");

    state.showConfigDialog("sorters");
    expect(state.configDialogOpen.value).toBe(true);
    expect(state.configTab.value).toBe("sorters");
  });

  it("showConfigDialog defaults to columns tab", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState());
          return () => h("div");
        },
      }),
    );

    state.showConfigDialog();
    expect(state.configTab.value).toBe("columns");
  });

  it("loadedCount is derived from results", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState());
          return () => h("div");
        },
      }),
    );

    expect(state.loadedCount.value).toBe(0);
    state.results.value = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(state.loadedCount.value).toBe(3);
  });
});

describe("provideTableContext / useTableContext", () => {
  it("provides and injects state", () => {
    let injected!: ReactiveTableState;

    const Child = defineComponent({
      setup() {
        injected = useTableContext().state;
        return () => h("div");
      },
    });

    mount(
      defineComponent({
        setup() {
          const { state } = createTableState();
          const { client } = createMockClient({ meta: createMockMeta([]) });
          provideTableContext({ state, client, components: {} });
          return () => h(Child);
        },
      }),
    );

    expect(injected).toBeDefined();
    expect(injected.tableDef.value).toBeNull();
  });

  it("throws when called outside provider", () => {
    expect(() => {
      mount(
        defineComponent({
          setup() {
            useTableContext();
            return () => h("div");
          },
        }),
      );
    }).toThrow();
  });
});
