// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { ColumnDef } from "@atscript/ui";
import AsTableRoot from "../components/as-table-root.vue";
import AsTable from "../components/as-table.vue";
import { clearTableCache } from "../composables/use-table";
import type { ReactiveTableState } from "../types";
import AsTableHeaderCell from "../components/defaults/as-table-header-cell.vue";
import { mockColumn } from "./helpers";

afterEach(() => {
  clearTableCache();
  document.body.innerHTML = "";
});

const columns: ColumnDef[] = [mockColumn("id"), mockColumn("name")];

const seed = [
  { id: 3, name: "carol" },
  { id: 1, name: "alice" },
  { id: 2, name: "bob" },
];

function mountLocal(
  opts: {
    rows?: Record<string, unknown>[];
    searchPaths?: string[];
    select?: "none" | "multi";
    clientFactory?: () => never;
    extraProps?: Record<string, unknown>;
  } = {},
) {
  let state!: ReactiveTableState;
  const rows = ref(opts.rows ?? seed);
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            AsTableRoot,
            {
              rows: rows.value,
              columns,
              searchPaths: opts.searchPaths,
              clientFactory: opts.clientFactory,
              rowValueFn: (row: Record<string, unknown>) => row.id,
              ...opts.extraProps,
            },
            {
              default: () =>
                h(AsTable, {
                  select: opts.select ?? "none",
                  onVnodeMounted: undefined,
                }),
            },
          );
      },
    }),
    { attachTo: document.body },
  );
  // `<AsTableRoot>` exposes its state; reach it through the rendered instance.
  state = (wrapper.findComponent(AsTableRoot).vm as unknown as { state: ReactiveTableState }).state;
  return { wrapper, state, rows };
}

function renderedNames(wrapper: ReturnType<typeof mountLocal>["wrapper"]): string[] {
  return wrapper.findAll("tbody tr").map((tr) => tr.findAll("td")[1]!.text());
}

describe("<AsTableRoot> local mode", () => {
  it("renders the given rows without a client or a metadata fetch", async () => {
    const clientFactory = vi.fn(() => {
      throw new Error("client must not be created in local mode");
    });
    const { wrapper, state } = mountLocal({ clientFactory: clientFactory as never });
    await flushPromises();

    expect(clientFactory).not.toHaveBeenCalled();
    expect(state.loadingMetadata.value).toBe(false);
    expect(state.totalCount.value).toBe(3);
    expect(renderedNames(wrapper)).toEqual(["carol", "alice", "bob"]);
  });

  it("sorts locally when the header asks for a sort", async () => {
    const { wrapper, state } = mountLocal();
    await flushPromises();

    const header = wrapper
      .findAllComponents(AsTableHeaderCell)
      .find((c) => (c.props() as { column: { path: string } }).column.path === "name")!;
    header.vm.$emit("sort", columns[1], "asc");
    await flushPromises();
    await flushPromises();

    expect(state.sorters.value).toEqual([{ field: "name", direction: "asc" }]);
    expect(renderedNames(wrapper)).toEqual(["alice", "bob", "carol"]);
  });

  it("filters on the search term across searchPaths", async () => {
    const { wrapper, state } = mountLocal({ searchPaths: ["name"] });
    await flushPromises();

    state.searchTerm.value = "ali";
    await new Promise((r) => setTimeout(r, 600));
    await flushPromises();

    expect(renderedNames(wrapper)).toEqual(["alice"]);
    expect(state.totalCount.value).toBe(1);
  });

  it("re-queries when the rows array is replaced", async () => {
    const { wrapper, rows } = mountLocal();
    await flushPromises();

    rows.value = [{ id: 9, name: "zoe" }];
    await flushPromises();
    await flushPromises();

    expect(renderedNames(wrapper)).toEqual(["zoe"]);
  });

  it("selects rows through the normal selection model", async () => {
    const { wrapper, state } = mountLocal({ select: "multi" });
    await flushPromises();

    await wrapper.findAll("tbody tr")[1]!.trigger("click");
    expect(state.selectedRows.value).toEqual([1]);
  });

  it("warns when a client-only feature is configured", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mountLocal({ extraProps: { url: "/db/tables/x", preset: { url: "/p", tableKey: "t" } } });
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes(":url is ignored"))).toBe(true);
    expect(messages.some((m) => m.includes("presets"))).toBe(true);
    warn.mockRestore();
  });
});
