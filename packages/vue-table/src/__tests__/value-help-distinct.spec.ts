import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref, shallowRef } from "vue";
import {
  resetMetaCache,
  setDefaultClientFactory,
  resetDefaultClientFactory,
  type ColumnDef,
} from "@atscript/ui";
import AsFilterValueHelp from "../components/internal/as-filter-value-help.vue";
import {
  createDistinctPager,
  declineIfRejected,
  useDistinctPicker,
  hasValuePicker,
} from "../composables/use-value-pickers";

const META = {
  type: {
    $v: 2,
    metadata: {},
    type: { kind: "object", props: {}, propsPatterns: [], tags: [] },
  },
};

function column(over: Partial<ColumnDef> = {}): ColumnDef {
  return {
    path: "city",
    label: "City",
    type: "text",
    valueKind: "string",
    sortable: true,
    filterable: true,
    nullable: true,
    order: 0,
    distinct: { url: "/customers", field: "city" },
    ...over,
  };
}

function fakeClient(aggregate: (q: unknown) => Promise<unknown>) {
  return { meta: () => Promise.resolve(META), aggregate: vi.fn(aggregate) } as never;
}

afterEach(() => {
  resetMetaCache();
  resetDefaultClientFactory();
});

async function mountDialog(col: ColumnDef) {
  const Wrapper = defineComponent({
    setup() {
      const conditions = ref([]);
      return () => h(AsFilterValueHelp as never, { column: col, modelValue: conditions.value });
    },
  });
  const wrapper = mount(Wrapper, { attachTo: document.body });
  const comp = wrapper.findComponent(AsFilterValueHelp as never);
  await flushPromises();
  await nextTick();
  const state = (
    (comp as unknown as { vm: { $: unknown } }).vm.$ as unknown as {
      setupState: { innerState: never };
    }
  ).setupState.innerState as unknown as {
    viewportRowCount: { value: number };
    totalCount: { value: number };
    results: { value: Record<string, unknown>[] };
  };
  state.viewportRowCount.value = 10;
  await flushPromises();
  await nextTick();
  await flushPromises();
  return { wrapper, state };
}

describe("AsFilterValueHelp — distinct values", () => {
  it("lists the grouped values of the column (sorted by the server), without the null group", async () => {
    const client = fakeClient(async () => [{ city: "Berlin" }, { city: "Bonn" }, { city: null }]);
    setDefaultClientFactory(() => client);
    const { wrapper, state } = await mountDialog(column());

    expect(
      (client as unknown as { aggregate: ReturnType<typeof vi.fn> }).aggregate,
    ).toHaveBeenCalledWith({
      controls: {
        $groupBy: ["city"],
        $select: ["city"],
        $sort: { city: 1 },
        $limit: 101,
        $skip: 0,
      },
    });
    expect(state.totalCount.value).toBe(2);
    expect(state.results.value.map((r) => r.__value)).toEqual(["Berlin", "Bonn"]);
    expect(wrapper.html()).toContain("Berlin");
  });

  it("omits $sort when the column is not sortable", async () => {
    const client = fakeClient(async () => []);
    setDefaultClientFactory(() => client);
    await mountDialog(column({ sortable: false }));
    const call = (client as unknown as { aggregate: ReturnType<typeof vi.fn> }).aggregate.mock
      .calls[0]![0] as { controls: Record<string, unknown> };
    expect(call.controls).not.toHaveProperty("$sort");
  });

  it("a 4xx answer shows an error state in the picker and is not remembered", async () => {
    let calls = 0;
    setDefaultClientFactory(() =>
      fakeClient(async () => {
        calls++;
        throw Object.assign(new Error("forbidden"), { status: 403 });
      }),
    );
    const col = column();
    await mountDialog(col);
    expect(calls).toBeGreaterThan(0);
    // still a distinct picker: the next mount asks again (nothing global declined it)
    const before = calls;
    await mountDialog(col);
    expect(calls).toBeGreaterThan(before);
    expect(hasValuePicker(undefined, col)).toBe(true);
  });
});

describe("hasValuePicker gating", () => {
  const opts = [{ key: "bug", label: "Bug" }];

  it("offers a picker on a value-filterable column (why: the picker emits eq / in)", () => {
    expect(hasValuePicker(undefined, column({ options: opts }))).toBe(true);
    expect(hasValuePicker(undefined, column({ options: opts, filterOps: ["$eq", "$in"] }))).toBe(
      true,
    );
  });

  it("offers none on an existence-only column (why: eq on JSON storage is a 400)", () => {
    const json = column({ options: opts, filterable: false, filterOps: ["$exists"] });
    expect(hasValuePicker(undefined, json)).toBe(false);
  });

  it("offers none when the reported ops lack eq and in", () => {
    expect(hasValuePicker(undefined, column({ options: opts, filterOps: ["$exists"] }))).toBe(
      false,
    );
  });
});

describe("createDistinctPager", () => {
  function pager(col: ColumnDef, rows: Record<string, unknown>[] = [{ city: "A" }]) {
    const client = fakeClient(async () => rows);
    setDefaultClientFactory(() => client);
    const aggregate = (client as unknown as { aggregate: ReturnType<typeof vi.fn> }).aggregate;
    // the page cache hangs on the loaded table definition
    const host = { tableDef: shallowRef({} as never) };
    return { fetch: createDistinctPager(host, col), aggregate };
  }

  it("pages a sortable column (ordered, so stable)", async () => {
    const { fetch, aggregate } = pager(column());
    await fetch("", 2, 10);
    const controls = aggregate.mock.calls[0]![0].controls;
    expect(controls.$sort).toEqual({ city: 1 });
    expect(controls.$skip).toBe(10);
  });

  it("the inline picker flags `more` (shown as N+) instead of exposing the one-past count", async () => {
    const { fetch } = pager(
      column(),
      Array.from({ length: 11 }, (_, i) => ({ city: `c${i}` })),
    );
    const picker = useDistinctPicker(fetch, 10, 5);
    await picker.load("");
    expect(picker.rows.value).toHaveLength(5);
    expect(picker.more.value).toBe(true);
    expect(picker.count.value - 1).toBe(10);
  });

  it("applies the table's forced scope, and re-asks when it changes", async () => {
    const client = fakeClient(async () => [{ city: "A" }]);
    setDefaultClientFactory(() => client);
    const aggregate = (client as unknown as { aggregate: ReturnType<typeof vi.fn> }).aggregate;
    const forceFilters = shallowRef<Record<string, unknown> | undefined>({ region: "EU" });
    const host = { tableDef: shallowRef({} as never), forceFilters: forceFilters as never };
    const fetch = createDistinctPager(host, column());

    await fetch("", 1, 100);
    expect(aggregate.mock.calls[0]![0].filter).toEqual({ region: "EU" });

    await fetch("be", 1, 100);
    expect(aggregate.mock.calls[1]![0].filter).toEqual({
      $and: [{ region: "EU" }, { city: { $regex: "/^be/i" } }],
    });

    // same scope: the unsearched first page is reused; another scope is another page
    await fetch("", 1, 100);
    expect(aggregate).toHaveBeenCalledTimes(2);
    forceFilters.value = { region: "US" };
    await fetch("", 1, 100);
    expect(aggregate).toHaveBeenCalledTimes(3);
    expect(aggregate.mock.calls[2]![0].filter).toEqual({ region: "US" });
  });

  it("does not page a non-sortable column: one page, no more", async () => {
    const { fetch, aggregate } = pager(
      column({ sortable: false }),
      Array.from({ length: 11 }, (_, i) => ({ city: `c${i}` })),
    );
    const first = await fetch("", 1, 10);
    expect(first.data).toHaveLength(10);
    expect(first.count).toBe(10);
    expect((await fetch("", 2, 10)).data).toEqual([]);
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it("reuses the unsearched first page, but not a searched one", async () => {
    const { fetch, aggregate } = pager(column());
    await fetch("", 1, 100);
    await fetch("", 1, 100);
    expect(aggregate).toHaveBeenCalledTimes(1);
    await fetch("be", 1, 100);
    await fetch("be", 1, 100);
    expect(aggregate).toHaveBeenCalledTimes(3);
  });

  it("does not cache a failed first page", async () => {
    let fail = true;
    const client = fakeClient(async () => {
      if (fail) throw Object.assign(new Error("boom"), { status: 500 });
      return [{ city: "A" }];
    });
    setDefaultClientFactory(() => client);
    const fetch = createDistinctPager(undefined, column());
    await expect(fetch("", 1, 100)).rejects.toThrow("boom");
    fail = false;
    expect((await fetch("", 1, 100)).data).toHaveLength(1);
  });
});

describe("dictionary picker decline", () => {
  const info = { url: "/countries", targetField: "code" };
  const col = column({ distinct: undefined, valueHelpInfo: info });

  it("a 4xx declines the picker for that table only, until the table definition reloads", () => {
    const host = { tableDef: shallowRef({} as never) };
    const other = { tableDef: shallowRef({} as never) };
    expect(hasValuePicker(host, col)).toBe(true);

    declineIfRejected(host, info, Object.assign(new Error("forbidden"), { status: 403 }));
    expect(hasValuePicker(host, col)).toBe(false);
    expect(hasValuePicker(other, col)).toBe(true);

    host.tableDef.value = {} as never; // reload
    expect(hasValuePicker(host, col)).toBe(true);
  });

  it("any other failure is no verdict", () => {
    const host = { tableDef: shallowRef({} as never) };
    declineIfRejected(host, info, Object.assign(new Error("boom"), { status: 500 }));
    declineIfRejected(host, info, new Error("network"));
    expect(hasValuePicker(host, col)).toBe(true);
  });
});
