import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { useTable } from "../composables/use-table";
import { useTableState } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import { createMockMeta, createMockClient } from "./helpers";

describe("useTable", () => {
  it("fetches metadata and initializes tableDef", async () => {
    const meta = createMockMeta(["name", "age"]);
    const client = createMockClient({ meta });
    let state!: ReactiveTableState;

    mount(
      defineComponent({
        setup() {
          state = useTable(client);
          return () => h("div");
        },
      }),
    );

    // Before meta loads
    expect(state.tableDef.value).toBeNull();

    await flushPromises();

    expect(state.tableDef.value).not.toBeNull();
    expect(state.tableDef.value!.columns.length).toBe(2);
    expect(state.columns.value.length).toBe(2);
  });

  it("triggers initial query when queryOnMount is true (default)", async () => {
    const meta = createMockMeta(["name"]);
    const data = [{ name: "Alice" }, { name: "Bob" }];
    const client = createMockClient({ meta, data, count: 2 });

    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          state = useTable(client);
          return () => h("div");
        },
      }),
    );

    await flushPromises();

    expect(state.results.value).toEqual(data);
    expect(state.totalCount.value).toBe(2);
    expect(state.loadedCount.value).toBe(2);
  });

  it("does not query on mount when queryOnMount is false", async () => {
    const meta = createMockMeta(["name"]);
    const findManyWithCount = vi.fn().mockResolvedValue({ data: [], count: 0 });
    const client = { meta: () => Promise.resolve(meta), findManyWithCount };

    mount(
      defineComponent({
        setup() {
          useTable(client, { queryOnMount: false });
          return () => h("div");
        },
      }),
    );

    await flushPromises();

    expect(findManyWithCount).not.toHaveBeenCalled();
  });

  it("sets metadataError when meta() fails", async () => {
    const client = {
      meta: () => Promise.reject(new Error("Network error")),
      findManyWithCount: vi.fn().mockResolvedValue({ data: [], count: 0 }),
    };

    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          state = useTable(client);
          return () => h("div");
        },
      }),
    );

    await flushPromises();

    expect(state.metadataError.value).toBeInstanceOf(Error);
    expect(state.metadataError.value!.message).toBe("Network error");
    expect(state.tableDef.value).toBeNull();
  });

  it("provides state so children can inject", async () => {
    const meta = createMockMeta(["name"]);
    const client = createMockClient({ meta });
    let childState!: ReactiveTableState;

    const Child = defineComponent({
      setup() {
        childState = useTableState();
        return () => h("div");
      },
    });

    mount(
      defineComponent({
        setup() {
          useTable(client);
          return () => h(Child);
        },
      }),
    );

    await flushPromises();

    expect(childState).toBeDefined();
    expect(childState.tableDef.value).not.toBeNull();
  });

  it("passes limit option to pagination", async () => {
    const meta = createMockMeta(["name"]);
    const client = createMockClient({ meta });
    let state!: ReactiveTableState;

    mount(
      defineComponent({
        setup() {
          state = useTable(client, { limit: 10 });
          return () => h("div");
        },
      }),
    );

    expect(state.pagination.value.itemsPerPage).toBe(10);
  });
});
