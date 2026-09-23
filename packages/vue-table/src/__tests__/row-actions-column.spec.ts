// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { Client, MetaResponse, TDbActionInfo } from "@atscript/db-client";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import AsTableRoot from "../components/as-table-root.vue";
import AsTable from "../components/as-table.vue";
import AsWindowTable from "../components/as-window-table.vue";
import { clearTableCache } from "../composables/use-table";

afterEach(() => {
  clearTableCache();
});

const block: TDbActionInfo = {
  name: "block",
  label: "Block",
  level: "row",
  processor: "backend",
  value: "/x/block",
  icon: "i-as-block",
};

function buildMeta(actions: TDbActionInfo[]): MetaResponse {
  const obj = defineAnnotatedType("object");
  obj.prop("id", defineAnnotatedType().designType("string").$type);
  obj.prop("name", defineAnnotatedType().designType("string").$type);
  return {
    type: serializeAnnotatedType(obj.$type),
    fields: {
      id: { sortable: true, filterable: true },
      name: { sortable: true, filterable: true },
    },
    primaryKeys: ["id"],
    preferredId: ["id"],
    crud: { query: [], pages: [], one: [] },
    actions,
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  } as MetaResponse;
}

function makeClient(
  meta: MetaResponse,
  data: Record<string, unknown>[] = [{ id: "u1", name: "Ann" }],
  queries: unknown[] = [],
) {
  const client = {
    meta: () => Promise.resolve(meta),
    pages: (query: unknown) => {
      queries.push(query);
      return Promise.resolve({ data, count: data.length, page: 1, itemsPerPage: 50, pages: 1 });
    },
    action: async () => ({ ok: true }),
  } as unknown as Client;
  return client;
}

interface MountOpts {
  rowActionsColumn?: "first" | "last" | "merge-select" | false;
  actions?: TDbActionInfo[];
  url?: string;
}

function mountTable(opts: MountOpts = {}) {
  const meta = buildMeta(opts.actions ?? [block]);
  const client = makeClient(meta);
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          AsTableRoot as unknown as Parameters<typeof h>[0],
          { url: opts.url ?? "/rac", clientFactory: () => client },
          {
            default: () =>
              h(AsTable, {
                rowActionsColumn: opts.rowActionsColumn,
              }),
          },
        );
    },
  });
  return mount(Host);
}

describe("rowActionsColumn — synthesized __actions column", () => {
  it("default (false): no __actions column rendered", async () => {
    const wrapper = mountTable();
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('[data-column-path="__actions"]').exists()).toBe(false);
  });

  it("'first': prepended __actions column appears", async () => {
    const wrapper = mountTable({ rowActionsColumn: "first" });
    await flushPromises();
    await flushPromises();
    const ths = wrapper.findAll("thead th[data-column-path]");
    expect(ths[0]!.attributes("data-column-path")).toBe("__actions");
  });

  it("'last': appended __actions column appears", async () => {
    const wrapper = mountTable({ rowActionsColumn: "last", url: "/rac-last" });
    await flushPromises();
    await flushPromises();
    const ths = wrapper.findAll("thead th[data-column-path]");
    expect(ths[ths.length - 1]!.attributes("data-column-path")).toBe("__actions");
  });

  it("hidden when actions.row is empty even with rowActionsColumn='first'", async () => {
    const wrapper = mountTable({ rowActionsColumn: "first", actions: [], url: "/rac-empty" });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('[data-column-path="__actions"]').exists()).toBe(false);
  });

  it("__actions header is not draggable and has no resize handle", async () => {
    const wrapper = mountTable({ rowActionsColumn: "last", url: "/rac-locked" });
    await flushPromises();
    await flushPromises();
    const th = wrapper.find('th[data-column-path="__actions"]');
    expect(th.exists()).toBe(true);
    expect(th.attributes("draggable")).toBeUndefined();
    expect(th.find(".as-th-resize-handle").exists()).toBe(false);
  });

  it("__actions header has aria-label='Actions'", async () => {
    const wrapper = mountTable({ rowActionsColumn: "first", url: "/rac-aria" });
    await flushPromises();
    await flushPromises();
    const th = wrapper.find('th[data-column-path="__actions"]');
    expect(th.attributes("aria-label")).toBe("Actions");
  });
});

describe("rowActionsColumn on <AsWindowTable>", () => {
  function mountWindow(opts: MountOpts = {}) {
    const meta = buildMeta(opts.actions ?? [block]);
    const queries: unknown[] = [];
    const client = makeClient(meta, undefined, queries);
    const Host = defineComponent({
      setup() {
        return () =>
          h(
            AsTableRoot as unknown as Parameters<typeof h>[0],
            { url: opts.url ?? "/rac-window", clientFactory: () => client },
            {
              // `rows` pins the viewport: happy-dom has no layout to measure.
              default: () => h(AsWindowTable, { rows: 1, rowActionsColumn: opts.rowActionsColumn }),
            },
          );
      },
    });
    return { wrapper: mount(Host), queries };
  }

  it("default (false): no __actions column, no $actions request", async () => {
    const { wrapper, queries } = mountWindow({ url: "/racw-off" });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('[data-column-path="__actions"]').exists()).toBe(false);
    expect(wrapper.find(".as-row-actions").exists()).toBe(false);
    const last = queries[queries.length - 1] as { controls?: Record<string, unknown> };
    expect(last?.controls?.$actions).toBeUndefined();
  });

  it("'first': leading header, a row-actions cell per row, and $actions requested", async () => {
    const { wrapper, queries } = mountWindow({ rowActionsColumn: "first", url: "/racw-first" });
    await flushPromises();
    await flushPromises();
    const ths = wrapper.findAll("thead th[data-column-path]");
    expect(ths[0]!.attributes("data-column-path")).toBe("__actions");
    const row = wrapper.find("tr.as-window-data-row");
    expect(row.exists()).toBe(true);
    expect(row.findAll("td")[0]!.classes()).toContain("as-row-actions");
    const last = queries[queries.length - 1] as { controls?: Record<string, unknown> };
    expect(last?.controls?.$actions).toBe(true);
  });

  it("'last': trailing column, before the filler cell", async () => {
    const { wrapper } = mountWindow({ rowActionsColumn: "last", url: "/racw-last" });
    await flushPromises();
    await flushPromises();
    const ths = wrapper.findAll("thead th[data-column-path]");
    expect(ths[ths.length - 1]!.attributes("data-column-path")).toBe("__actions");
    const tds = wrapper.find("tr.as-window-data-row").findAll("td");
    expect(tds[tds.length - 2]!.classes()).toContain("as-row-actions");
    expect(tds[tds.length - 1]!.classes()).toContain("as-td-filler");
  });

  it("hidden when actions.row is empty", async () => {
    const { wrapper } = mountWindow({
      rowActionsColumn: "first",
      actions: [],
      url: "/racw-empty",
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('[data-column-path="__actions"]').exists()).toBe(false);
  });
});
