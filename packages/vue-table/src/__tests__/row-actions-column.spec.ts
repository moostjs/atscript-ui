// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { Client, MetaResponse, TDbActionInfo } from "@atscript/db-client";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import AsTableRoot from "../components/as-table-root.vue";
import AsTable from "../components/as-table.vue";
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
) {
  const client = {
    meta: () => Promise.resolve(meta),
    pages: () => Promise.resolve({ data, count: data.length, page: 1, itemsPerPage: 50, pages: 1 }),
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
