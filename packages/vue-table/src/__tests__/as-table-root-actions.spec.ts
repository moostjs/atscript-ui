import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import type { Client, MetaResponse, TDbActionInfo } from "@atscript/db-client";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import AsTableRoot from "../components/as-table-root.vue";
import { clearTableCache } from "../composables/use-table";

afterEach(() => {
  clearTableCache();
});

const block: TDbActionInfo = {
  name: "block",
  label: "Block",
  level: "row",
  processor: "backend",
  value: "/users/actions/block",
};

const customExport: TDbActionInfo = {
  name: "export",
  label: "Export",
  level: "table",
  processor: "custom",
  value: "export",
};

function buildMeta(actions: TDbActionInfo[]): MetaResponse {
  const obj = defineAnnotatedType("object");
  const id = defineAnnotatedType().designType("string");
  obj.prop("id", id.$type);
  obj.prop("name", defineAnnotatedType().designType("string").$type);
  return {
    type: serializeAnnotatedType(obj.$type),
    fields: {
      id: { sortable: true, filterable: true },
      name: { sortable: true, filterable: true },
    },
    primaryKeys: ["id"],
    crud: { query: [], pages: [], one: [] },
    actions,
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  } as MetaResponse;
}

function makeClient(opts: { meta: MetaResponse; actionImpl?: () => Promise<unknown> }) {
  const pagesFn = vi.fn().mockResolvedValue({
    data: [],
    count: 0,
    page: 1,
    itemsPerPage: 50,
    pages: 1,
  });
  const actionFn = vi.fn(opts.actionImpl ?? (async () => ({ ok: true })));
  const client = {
    meta: () => Promise.resolve(opts.meta),
    pages: pagesFn,
    action: actionFn,
  } as unknown as Client;
  return { client, pagesFn, actionFn };
}

interface MountOpts {
  url: string;
  client: Client;
  refreshOnAction?: boolean;
  rowDelete?: boolean;
}

function mountRoot(opts: MountOpts) {
  const captured: { state?: unknown } = {};
  const events: Array<{ action: TDbActionInfo; ids: unknown[]; result: unknown }> = [];
  const Host = defineComponent({
    setup() {
      const slotProps = ref<Record<string, unknown> | null>(null);
      return () =>
        h(
          AsTableRoot as unknown as Parameters<typeof h>[0],
          {
            url: opts.url,
            clientFactory: () => opts.client,
            refreshOnAction: opts.refreshOnAction,
            rowDelete: opts.rowDelete,
            onAction: (action: TDbActionInfo, ids: unknown[], result: unknown) => {
              events.push({ action, ids, result });
            },
          },
          {
            default: (props: Record<string, unknown>) => {
              slotProps.value = props;
              captured.state = (props as { actions?: unknown }).actions;
              return [];
            },
          },
        );
    },
  });
  const wrapper = mount(Host);
  return { wrapper, captured, events };
}

describe("<AsTableRoot> actions slot props + @action", () => {
  it("exposes actions namespace + per-level defaults via slot props", async () => {
    const meta = buildMeta([
      { ...block, default: true },
      { ...customExport, default: true },
    ]);
    const { client } = makeClient({ meta });
    const { wrapper } = mountRoot({ url: "/x1", client });
    await flushPromises();
    await flushPromises();

    const root = wrapper.findComponent(AsTableRoot as unknown as never) as unknown as {
      vm: unknown;
    };
    const state = (
      root.vm as unknown as {
        state: {
          tableDef: { value: { actions?: unknown } | null };
          actions: { default: Record<string, unknown>; row: unknown[]; table: unknown[] };
        };
      }
    ).state;
    expect(state.tableDef.value).not.toBeNull();
    expect(state.actions.row).toHaveLength(1);
    expect(state.actions.table).toHaveLength(1);
    expect(state.actions.default.row).toBeDefined();
    expect((state.actions.default.row as { name: string }).name).toBe("block");
    expect((state.actions.default.table as { name: string }).name).toBe("export");
  });

  it("@action fires for backend success", async () => {
    const meta = buildMeta([block]);
    const { client } = makeClient({ meta });
    const { wrapper, events } = mountRoot({ url: "/x2", client });
    await flushPromises();
    const state = (
      (wrapper.findComponent(AsTableRoot as unknown as never) as unknown as { vm: unknown })
        .vm as unknown as {
        state: { actions: { invoke: (a: TDbActionInfo, pk: unknown) => Promise<unknown> } };
      }
    ).state;
    await state.actions.invoke(block, "user-1");
    expect(events).toHaveLength(1);
    expect(events[0]!.action.name).toBe("block");
    expect(events[0]!.ids).toEqual(["user-1"]);
    expect((events[0]!.result as { ok: boolean }).ok).toBe(true);
  });

  it("@action fires for backend failure", async () => {
    const meta = buildMeta([block]);
    const { client } = makeClient({
      meta,
      actionImpl: () => Promise.reject(new Error("denied")),
    });
    const { wrapper, events } = mountRoot({ url: "/x3", client });
    await flushPromises();
    const state = (
      (wrapper.findComponent(AsTableRoot as unknown as never) as unknown as { vm: unknown })
        .vm as unknown as {
        state: { actions: { invoke: (a: TDbActionInfo, pk: unknown) => Promise<unknown> } };
      }
    ).state;
    await state.actions.invoke(block, "user-1");
    expect(events).toHaveLength(1);
    expect((events[0]!.result as { ok: boolean }).ok).toBe(false);
  });

  it("@action fires for custom dispatch", async () => {
    const meta = buildMeta([customExport]);
    const { client } = makeClient({ meta });
    const { wrapper, events } = mountRoot({ url: "/x4", client });
    await flushPromises();
    const state = (
      (wrapper.findComponent(AsTableRoot as unknown as never) as unknown as { vm: unknown })
        .vm as unknown as {
        state: { actions: { invoke: (a: TDbActionInfo) => Promise<unknown> } };
      }
    ).state;
    await state.actions.invoke(customExport);
    expect(events).toHaveLength(1);
    expect((events[0]!.result as { kind: string }).kind).toBe("custom");
    expect(events[0]!.ids).toEqual([]);
  });

  it(':refreshOnAction="false" skips post-success refresh', async () => {
    const meta = buildMeta([block]);
    const { client, pagesFn } = makeClient({ meta });
    const { wrapper } = mountRoot({ url: "/x5", client, refreshOnAction: false });
    await flushPromises();
    pagesFn.mockClear();
    const state = (
      (wrapper.findComponent(AsTableRoot as unknown as never) as unknown as { vm: unknown })
        .vm as unknown as {
        state: { actions: { invoke: (a: TDbActionInfo, pk: unknown) => Promise<unknown> } };
      }
    ).state;
    await state.actions.invoke(block, "user-1");
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();
  });
});
