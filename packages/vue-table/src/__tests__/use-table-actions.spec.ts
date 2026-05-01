// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import type { Client } from "@atscript/db-client";
import { createTableState, provideTableContext } from "../composables/use-table-state";
import { useTableActions } from "../composables/use-table-actions";
import type { TableActionsState } from "../types";
import { mockColumn, mockTableDef } from "./helpers";

describe("useTableActions", () => {
  it("returns the actions namespace inside the provider", () => {
    let captured: TableActionsState | null = null;
    const Inner = defineComponent({
      setup() {
        captured = useTableActions();
        return () => h("div");
      },
    });
    const Host = defineComponent({
      setup() {
        const client = {
          meta: () => Promise.resolve({} as never),
          pages: () => Promise.resolve({ data: [], count: 0, page: 1, itemsPerPage: 50, pages: 1 }),
        } as unknown as Client;
        const { state, internals } = createTableState({
          client,
          query: { queryOnMount: false },
        });
        internals.init(mockTableDef([mockColumn("id")]));
        provideTableContext({ state, client, controls: {} });
        return () => h(Inner);
      },
    });
    mount(Host);
    expect(captured).not.toBeNull();
    expect(typeof captured!.invoke).toBe("function");
    expect(captured!.invoking).toBeDefined();
    expect(captured!.lastResult).toBeDefined();
    expect(Array.isArray(captured!.row)).toBe(true);
  });

  it("throws when called outside provider", () => {
    const Probe = defineComponent({
      setup() {
        useTableActions();
        return () => h("div");
      },
    });
    expect(() => mount(Probe)).toThrow(/useTableContext.+outside/);
  });
});
