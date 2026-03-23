import { describe, it, expect, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { Client } from "@atscript/db-client";
import { useTable, clearTableCache } from "../composables/use-table";
import { useTableContext } from "../composables/use-table-state";
import type { ReactiveTableState } from "../types";
import { createMockMeta, createMockClient } from "./helpers";

afterEach(() => {
  clearTableCache();
});

function withClientFactory(client: Client) {
  return { clientFactory: () => client };
}

describe("useTable", () => {
  it("fetches metadata and initializes tableDef", async () => {
    const meta = createMockMeta(["name", "age"]);
    const { client } = createMockClient({ meta });
    let state!: ReactiveTableState;

    mount(
      defineComponent({
        setup() {
          state = useTable("/test", withClientFactory(client));
          return () => h("div");
        },
      }),
    );

    expect(state.tableDef.value).toBeNull();

    await flushPromises();

    expect(state.tableDef.value).not.toBeNull();
    expect(state.tableDef.value!.columns.length).toBe(2);
    expect(state.columns.value.length).toBe(2);
  });

  it("triggers initial query when queryOnMount is true (default)", async () => {
    const meta = createMockMeta(["name"]);
    const data = [{ name: "Alice" }, { name: "Bob" }];
    const { client } = createMockClient({ meta, data, count: 2 });

    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          state = useTable("/test2", withClientFactory(client));
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
    const { client, pagesFn } = createMockClient({ meta });

    mount(
      defineComponent({
        setup() {
          useTable("/test3", { queryOnMount: false, ...withClientFactory(client) });
          return () => h("div");
        },
      }),
    );

    await flushPromises();

    expect(pagesFn).not.toHaveBeenCalled();
  });

  it("sets metadataError when meta() fails", async () => {
    const { client } = createMockClient({ meta: createMockMeta([]) });
    client.meta = () => Promise.reject(new Error("Network error"));

    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          state = useTable("/test4", withClientFactory(client));
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
    const { client } = createMockClient({ meta });
    let childState!: ReactiveTableState;

    const Child = defineComponent({
      setup() {
        childState = useTableContext().state;
        return () => h("div");
      },
    });

    mount(
      defineComponent({
        setup() {
          useTable("/test5", withClientFactory(client));
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
    const { client } = createMockClient({ meta });
    let state!: ReactiveTableState;

    mount(
      defineComponent({
        setup() {
          state = useTable("/test6", { limit: 10, ...withClientFactory(client) });
          return () => h("div");
        },
      }),
    );

    expect(state.pagination.value.itemsPerPage).toBe(10);
  });
});
