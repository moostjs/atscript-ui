import { describe, it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { createTableState } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import { createMockClient, createMockMeta, mockColumn, mockTableDef, rows } from "./helpers";
import type { TableStateInternals } from "../composables/use-table-state";

describe("Custom consumer auto-bootstrap on metadata load", () => {
  it("query fires automatically when tableDef + allColumns become non-null", async () => {
    const mock = createMockClient({
      meta: createMockMeta(["name"]),
      data: rows(0, 50),
      count: 1000,
    });
    let state!: ReactiveTableState;
    let internals!: TableStateInternals;
    mount(
      defineComponent({
        setup() {
          ({ state, internals } = createTableState({ client: mock.client }));
          return () => h("div");
        },
      }),
    );
    expect(mock.pagesFn).not.toHaveBeenCalled();

    // Defer metadata-load until after a tick.
    await nextTick();
    internals.init(mockTableDef([mockColumn("name")]));
    await flushPromises();
    expect(mock.pagesFn).toHaveBeenCalledOnce();
    expect(state.results.value.length).toBe(50);
  });

  it("does NOT fire again on subsequent metadata reloads when results are populated", async () => {
    const mock = createMockClient({
      meta: createMockMeta(["name"]),
      data: rows(0, 50),
      count: 1000,
    });
    let internals!: TableStateInternals;
    mount(
      defineComponent({
        setup() {
          ({ internals } = createTableState({ client: mock.client }));
          return () => h("div");
        },
      }),
    );
    const def = mockTableDef([mockColumn("name")]);
    internals.init(def);
    await flushPromises();
    expect(mock.pagesFn).toHaveBeenCalledOnce();
    // Re-init with same def — guard prevents re-bootstrap.
    internals.init(def);
    await flushPromises();
    expect(mock.pagesFn).toHaveBeenCalledOnce();
  });
});
