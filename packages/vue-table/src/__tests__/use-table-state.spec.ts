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

  it("init populates tableDef and columns", () => {
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
    // Only visible columns
    expect(state.columns.value).toEqual([cols[0], cols[1]]);
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

  it("resetFilters clears filters and resets page", () => {
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          ({ state } = createTableState());
          return () => h("div");
        },
      }),
    );

    state.filters.value = { name: [{ type: "eq", value: ["test"] }] };
    state.pagination.value = { page: 3, itemsPerPage: 50 };
    state.resetFilters();

    expect(state.filters.value).toEqual({});
    expect(state.pagination.value.page).toBe(1);
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
