import { describe, it, expect } from "vitest";
import { createTableState } from "../composables/use-table-state";
import { useTableColumnHandlers } from "../composables/use-table-column-handlers";
import { mockColumn, mountSetup, stubClient } from "./helpers";

function setup() {
  return mountSetup(() => {
    const { state } = createTableState({
      client: stubClient(),
      query: { queryOnMount: false },
    });
    return { state, handlers: useTableColumnHandlers(state) };
  });
}

describe("useTableColumnHandlers", () => {
  const colA = mockColumn("a");
  const colB = mockColumn("b");

  describe("onSort", () => {
    it("sets a single sorter from empty", () => {
      const { state, handlers } = setup();
      expect(state.sorters.value).toEqual([]);

      handlers.onSort(colA, "asc");
      expect(state.sorters.value).toEqual([{ field: "a", direction: "asc" }]);
    });

    it("replaces a pre-existing sorter, dropping a system-preset sorter like _id", () => {
      const { state, handlers } = setup();
      state.sorters.value = [{ field: "_id", direction: "desc" }];

      handlers.onSort(colA, "asc");
      expect(state.sorters.value).toEqual([{ field: "a", direction: "asc" }]);
    });

    it("replaces an existing single sorter rather than appending", () => {
      const { state, handlers } = setup();
      state.sorters.value = [{ field: "a", direction: "asc" }];

      handlers.onSort(colB, "desc");
      expect(state.sorters.value).toEqual([{ field: "b", direction: "desc" }]);
    });

    it("clears all sorters when direction is null", () => {
      const { state, handlers } = setup();
      state.sorters.value = [{ field: "a", direction: "asc" }];

      handlers.onSort(colA, null);
      expect(state.sorters.value).toEqual([]);
    });
  });
});
