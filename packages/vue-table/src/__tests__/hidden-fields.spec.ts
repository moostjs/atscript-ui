// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, ref, shallowRef } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import {
  type AsPresetEntryRow,
  type PresetSnapshot,
  type SystemPreset,
  resolveSystemPresets,
  toWireSnapshot,
} from "@atscript/ui-table";
import type { Uniquery } from "@uniqu/core";
import { createTableState, type TableStateInternals } from "../composables/use-table-state";
import type { UseLocalDraftReturn } from "../composables/use-local-draft";
import type { UsePresetsReturn } from "../composables/use-presets";
import type { DroppedFieldsReport, ReactiveTableState } from "../types";
import { createMockClient, createMockMeta, mockColumn, mockTableDef } from "./helpers";

// A preset written by a role that sees more fields (`email`, `roleId`) is
// applied by one that only sees `id`, `username`, `status`. It must degrade to
// what this role can see — never fail the query.

const VISIBLE = ["id", "username", "status"];
const contains = (v: string) => [{ type: "contains" as const, value: [v] }];
const eq = (v: string) => [{ type: "eq" as const, value: [v] }];

const ADMIN_VIEW: PresetSnapshot = {
  columns: { columnNames: ["username", "email", "roleId", "status"] },
  filters: ["email", "status"],
  filterOps: { email: contains("@"), status: eq("active") },
  sorters: [
    { field: "email", direction: "desc" },
    { field: "username", direction: "asc" },
  ],
};

function presetRow(id: string, content: PresetSnapshot): AsPresetEntryRow {
  return {
    id,
    type: "preset",
    app: "demo",
    tableKey: "users",
    user: "me",
    label: id,
    public: true,
    data: { label: id, content: toWireSnapshot(content) },
  } as unknown as AsPresetEntryRow;
}

/** A presets handle still loading — flip `loading` to resolve it, like the real one. */
function makeHandle(rows: AsPresetEntryRow[], opts: { defaultId?: string } = {}) {
  const presets = shallowRef(rows);
  const system: SystemPreset[] = resolveSystemPresets();
  const activePresetId = ref<string | null>(null);
  const handle = {
    presets,
    presetsById: computed(() => new Map(presets.value.map((r) => [r.id, r]))),
    userConf: shallowRef(opts.defaultId ? { data: { defaultPresetId: opts.defaultId } } : null),
    capabilities: ref(null),
    systemPresets: computed(() => system),
    systemPresetsById: computed(() => new Map(system.map((p) => [p.id, p]))),
    available: computed(() => true),
    loading: ref(true),
    error: ref(null),
    currentUser: computed(() => "me"),
    activePresetId,
    activePreset: computed(() => null),
    isOwned: () => true,
    reload: async () => {},
    batch: <T>(fn: () => Promise<T>) => fn(),
    savePreset: vi.fn(async () => {}),
    savePresetAs: vi.fn(async () => "new"),
    renamePreset: vi.fn(),
    deletePreset: vi.fn(),
    togglePublic: vi.fn(),
    setDefault: vi.fn(),
    toggleFav: vi.fn(),
    setFavorites: vi.fn(),
  };
  return handle as unknown as UsePresetsReturn & {
    loading: { value: boolean };
    savePreset: ReturnType<typeof vi.fn>;
    savePresetAs: ReturnType<typeof vi.fn>;
  };
}

function draftOver(overlay: PresetSnapshot): UseLocalDraftReturn {
  return {
    hydrate: (applied) => ({ ...applied, ...overlay }),
    watchAndPersist: () => () => {},
    clear: () => {},
    readDraft: () => null,
  };
}

function setup(
  opts: {
    handle?: UsePresetsReturn;
    draft?: UseLocalDraftReturn;
    initNow?: boolean;
    initialColumnNames?: string[];
  } = {},
) {
  const reports: DroppedFieldsReport[] = [];
  const { client, pagesFn } = createMockClient({ meta: createMockMeta(VISIBLE), data: [] });
  const def = mockTableDef(VISIBLE.map((p) => mockColumn(p)));
  let state!: ReactiveTableState;
  let internals!: TableStateInternals;
  mount(
    defineComponent({
      setup() {
        ({ state, internals } = createTableState({
          client,
          model: opts.initialColumnNames
            ? { columnNames: shallowRef(opts.initialColumnNames) }
            : undefined,
          query: { onFieldsDropped: (r) => reports.push(r) },
          preset: {
            presetsHandle: opts.handle,
            draftHandle: opts.draft,
            persistDrafts: !!opts.draft,
          },
        }));
        if (opts.initNow !== false) internals.init(def);
        return () => h("div");
      },
    }),
  );
  const lastQuery = () => (pagesFn.mock.calls.at(-1) as [Uniquery] | undefined)?.[0];
  const resolvePresets = async () => {
    (opts.handle as unknown as { loading: { value: boolean } }).loading.value = false;
    await flushPromises();
  };
  return { state, reports, pagesFn, lastQuery, resolvePresets, init: () => internals.init(def) };
}

/** Every field a query names, anywhere. */
function queryFields(q: Uniquery | undefined): string[] {
  return JSON.stringify(q ?? {}).match(/"(email|roleId)"/g) ?? [];
}

function expectPruned(state: ReactiveTableState) {
  expect(state.columnNames.value).toEqual(["username", "status"]);
  expect(state.filterFields.value).toEqual(["status"]);
  expect(state.filters.value).toEqual({ status: eq("active") });
  expect(state.sorters.value).toEqual([{ field: "username", direction: "asc" }]);
}

describe("hidden fields — preset apply", () => {
  it("applies a stored preset without the hidden fields, clean and reported once", async () => {
    const handle = makeHandle([presetRow("admin-view", ADMIN_VIEW)]);
    const { state, reports, lastQuery, resolvePresets } = setup({ handle });
    await resolvePresets();
    reports.length = 0;

    state.preset.apply("admin-view");
    await flushPromises();
    await new Promise((r) => setTimeout(r, 0));

    expectPruned(state);
    expect(state.preset.isDirty.value).toBe(false);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      source: "preset",
      presetId: "admin-view",
      fields: ["email", "roleId"],
      columns: ["email", "roleId"],
      filterFields: ["email"],
      filters: { email: contains("@") },
      sorters: [{ field: "email", direction: "desc" }],
    });
    expect(state.preset.droppedFields.value).toEqual(reports[0]);
    // The query the root watcher runs never names a hidden field.
    expect(queryFields(state.buildQuery())).toEqual([]);
    expect(queryFields(lastQuery())).toEqual([]);
  });

  it("clears the note once another preset becomes active", async () => {
    const handle = makeHandle([presetRow("admin-view", ADMIN_VIEW)]);
    const { state, resolvePresets } = setup({ handle });
    await resolvePresets();
    state.preset.apply("admin-view");
    expect(state.preset.droppedFields.value).not.toBeNull();
    state.preset.apply("sys:standard");
    expect(state.preset.droppedFields.value).toBeNull();
  });

  it("presets resolved BEFORE meta: bootstrap waits, applies pruned, the first query is clean", async () => {
    const handle = makeHandle([presetRow("admin-view", ADMIN_VIEW)], { defaultId: "admin-view" });
    const { state, reports, pagesFn, lastQuery, init, resolvePresets } = setup({
      handle,
      initNow: false,
    });
    await resolvePresets();
    // Nothing applied yet: bootstrap waits for the table definition.
    expect(state.preset.activeId.value).toBeNull();
    expect(state.columnNames.value).toEqual([]);
    expect(reports).toEqual([]);

    init();
    await flushPromises();

    expectPruned(state);
    expect(state.preset.isDirty.value).toBe(false);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ source: "preset", presetId: "admin-view" });
    expect(state.preset.droppedFields.value).not.toBeNull();
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(queryFields(lastQuery())).toEqual([]);
  });

  it("presets resolved AFTER meta: pruned in apply, the first query is clean", async () => {
    const handle = makeHandle([presetRow("admin-view", ADMIN_VIEW)], { defaultId: "admin-view" });
    const { state, reports, pagesFn, lastQuery, resolvePresets } = setup({ handle });
    await flushPromises();
    expect(pagesFn).not.toHaveBeenCalled();

    await resolvePresets();

    expectPruned(state);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ source: "preset", presetId: "admin-view" });
    expect(pagesFn).toHaveBeenCalledTimes(1);
    expect(queryFields(lastQuery())).toEqual([]);
  });

  it("a draft naming a hidden field is pruned and reported with the default preset", async () => {
    const handle = makeHandle([]);
    const draft = draftOver({ columns: { columnNames: ["email", "username"] } });
    const { state, reports, resolvePresets } = setup({ handle, draft });
    await resolvePresets();

    expect(state.columnNames.value).toEqual(["username"]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      source: "preset",
      presetId: "sys:standard",
      columns: ["email"],
    });
  });

  it("initial v-model state naming a hidden field stays in the model but never reaches the query", async () => {
    const { state, reports, lastQuery } = setup({ initialColumnNames: ["email", "id"] });
    await flushPromises();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(state.columnNames.value).toEqual(["email", "id"]);
      expect(state.columns.value.map((c) => c.path)).toEqual(["id"]);
      expect(reports).toEqual([]);
      expect(queryFields(lastQuery())).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("hidden fields — saving", () => {
  it("saveActive after a pruned apply keeps the hidden entries of the stored preset", async () => {
    const handle = makeHandle([presetRow("admin-view", ADMIN_VIEW)]);
    const { state, resolvePresets } = setup({ handle });
    await resolvePresets();
    state.preset.apply("admin-view");
    state.sorters.value = [{ field: "status", direction: "asc" }];

    await state.preset.saveActive();

    // The hidden entries go back after the visible ones.
    const saved = handle.savePreset.mock.calls[0][0] as PresetSnapshot;
    expect(saved.columns!.columnNames).toEqual(["username", "status", "email", "roleId"]);
    expect(saved.filters).toEqual(["status", "email"]);
    expect(saved.filterOps).toEqual({ status: eq("active"), email: contains("@") });
    expect(saved.sorters).toEqual([
      { field: "status", direction: "asc" },
      { field: "email", direction: "desc" },
    ]);
  });

  it("saveAs holds only the fields the saver can see", async () => {
    const handle = makeHandle([presetRow("admin-view", ADMIN_VIEW)]);
    const { state, resolvePresets } = setup({ handle });
    await resolvePresets();
    state.preset.apply("admin-view");

    await state.preset.saveAs("Mine");

    const saved = handle.savePresetAs.mock.calls[0][1] as PresetSnapshot;
    expect(JSON.stringify(saved)).not.toMatch(/email|roleId/);
  });
});

describe("hidden fields — residual filters and the query safety net", () => {
  it("gates state written straight to the model out of the query, warning once per path set", () => {
    const { state, reports } = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      state.columnNames.value = ["username", "email"];
      state.sorters.value = [{ field: "email", direction: "asc" }];
      state.filters.value = { email: eq("x"), status: eq("active") };
      const ok = { $or: [{ username: "a" }, { status: "b" }] };
      state.setResidualFilters([ok, { $or: [{ status: "a" }, { roleId: 1 }] }]);

      const q = state.buildQuery();
      expect(q.controls!.$select).toEqual(["username"]);
      expect(q.controls!.$sort).toBeUndefined();
      expect(q.filter).toEqual({ $and: [{ status: "active" }, ok] });
      state.buildQuery();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("email, roleId"));
      // Not an apply: nothing is reported.
      expect(reports).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it("never prunes forceFilters / forceSorters", () => {
    const { client } = createMockClient({ meta: createMockMeta(VISIBLE) });
    let state!: ReactiveTableState;
    mount(
      defineComponent({
        setup() {
          const made = createTableState({
            client,
            query: {
              forceFilters: { roleId: 1 },
              forceSorters: [{ field: "roleId", direction: "asc" }],
            },
          });
          state = made.state;
          made.internals.init(mockTableDef(VISIBLE.map((p) => mockColumn(p))));
          return () => h("div");
        },
      }),
    );
    const q = state.buildQuery();
    expect(q.filter).toEqual({ roleId: 1 });
    expect(q.controls!.$sort).toEqual({ roleId: 1 });
  });
});
