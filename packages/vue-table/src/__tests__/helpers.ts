import type { ColumnDef, MetaResponse, TableDef } from "@atscript/ui";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import type { Client } from "@atscript/db-client";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { vi } from "vitest";
import { createTableState, type QueryFn } from "../composables/use-table-state";
import type { MainActionRequest, ReactiveTableState } from "../types";
import type { FilterExpr } from "@uniqu/core";
import type { SortControl } from "@atscript/ui";

/**
 * Override `getBoundingClientRect()` on a single element so happy-dom returns
 * deterministic geometry for drag-position math.
 */
export function stubRect(el: Element, left: number, width: number, height = 24) {
  el.getBoundingClientRect = () =>
    ({
      left,
      width,
      top: 0,
      right: left + width,
      bottom: height,
      height,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** Resolve the rendered `<th>` for a column path; throws if not found. */
export function thByPath(root: ParentNode, path: string): HTMLElement {
  const th = root.querySelector(`th[data-column-path="${path}"]`);
  if (!th) throw new Error(`<th> for path "${path}" not found`);
  return th as HTMLElement;
}

/** Stubs `setPointerCapture` since happy-dom doesn't implement pointer capture. */
export function handleOf(th: HTMLElement): HTMLElement {
  const handle = th.querySelector(".as-th-resize-handle") as HTMLElement | null;
  if (!handle) throw new Error("resize handle not found in th");
  if (!(handle as HTMLElement & { setPointerCapture?: unknown }).setPointerCapture) {
    (handle as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  }
  return handle;
}

/** happy-dom doesn't implement PointerEvent — fill the gap with property injection. */
export function pointerEvent(type: string, init: Partial<PointerEvent> = {}) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.assign(ev, { pointerId: 1, pointerType: "mouse", isPrimary: true }, init);
  return ev;
}

/**
 * Build a synthetic native DragEvent with a stub DataTransfer. happy-dom does
 * not implement DragEvent / DataTransfer; this fills the gap for unit tests.
 */
export function dragEvent(type: string, init: Partial<DragEvent> = {}) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(ev, "dataTransfer", {
    value: {
      effectAllowed: "",
      dropEffect: "",
      setData: () => {},
      getData: () => "",
    },
    writable: false,
  });
  Object.assign(ev, init);
  return ev;
}

/**
 * Build a simple MetaResponse for testing.
 * Creates an object type with the given field names (all string, sortable, filterable).
 */
export function createMockMeta(fieldNames: string[]): MetaResponse {
  const h = defineAnnotatedType("object");
  for (const name of fieldNames) {
    const prop = defineAnnotatedType().designType("string");
    prop.annotate("meta.label" as keyof AtscriptMetadata, name as never);
    h.prop(name, prop.$type);
  }
  const serialized = serializeAnnotatedType(h.$type);

  const fields: Record<string, { sortable: boolean; filterable: boolean }> = {};
  for (const name of fieldNames) {
    fields[name] = { sortable: true, filterable: true };
  }

  return {
    type: serialized,
    fields,
    primaryKeys: ["id"],
    readOnly: false,
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  };
}

/**
 * Create a mock client for testing.
 * Returns a client whose meta() returns the given MetaResponse
 * and pages() returns the given data/count.
 */
export function createMockClient(opts: {
  meta: MetaResponse;
  data?: Record<string, unknown>[];
  count?: number;
}): { client: Client; pagesFn: ReturnType<typeof vi.fn> } {
  const pagesFn = vi.fn().mockResolvedValue({
    data: opts.data ?? [],
    count: opts.count ?? opts.data?.length ?? 0,
    page: 1,
    itemsPerPage: 50,
    pages: 1,
  });
  return {
    client: {
      meta: () => Promise.resolve(opts.meta),
      pages: pagesFn,
    } as unknown as Client,
    pagesFn,
  };
}

/**
 * Minimal stub Client for tests that don't exercise fetch behaviour. Calling
 * `pages` returns an empty page; tests that need real fetch behaviour should
 * use `createMockClient` instead.
 */
export function stubClient(): Client {
  return {
    meta: () => Promise.resolve({} as never),
    pages: () => Promise.resolve({ data: [], count: 0, page: 1, itemsPerPage: 50, pages: 1 }),
  } as unknown as Client;
}

/** Create a minimal ColumnDef for testing. */
export function mockColumn(path: string, overrides?: Partial<ColumnDef>): ColumnDef {
  return {
    path,
    label: path,
    type: "text",
    sortable: true,
    filterable: true,
    visible: true,
    order: 0,
    ...overrides,
  };
}

/** Generate `count` consecutive `{ id }` rows starting at `start`. */
export function rows(start: number, count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({ id: start + i }));
}

/** Create a minimal TableDef for testing. */
export function mockTableDef(columns: ColumnDef[]): TableDef {
  return {
    type: defineAnnotatedType("object").$type,
    columns,
    primaryKeys: ["id"],
    readOnly: false,
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  };
}

type MountTableStateOptions = {
  data?: Record<string, unknown>[];
  count?: number;
  pages?: ReturnType<typeof vi.fn>;
  client?: Client;
  columns?: ColumnDef[];
  queryOnMount?: boolean;
  blockSize?: number;
  blockQuery?: boolean;
  forceFilters?: FilterExpr;
  forceSorters?: SortControl[];
  queryFn?: QueryFn;
};

function buildClient(
  opts: MountTableStateOptions = {},
  defaults: { data: Record<string, unknown>[]; count: number },
) {
  const cols = opts.columns ?? [mockColumn("name")];
  const fields = cols.map((c) => c.path);
  const mock = createMockClient({
    meta: createMockMeta(fields),
    data: opts.data ?? defaults.data,
    count: opts.count ?? defaults.count,
  });
  if (opts.pages) mock.client.pages = opts.pages as never;
  return { ...mock, columns: cols };
}

function mountWith(
  opts: MountTableStateOptions,
  client: Client,
  initFn: (internals: { init: (def: TableDef) => void }) => void,
): ReactiveTableState {
  let state!: ReactiveTableState;
  mount(
    defineComponent({
      setup() {
        const { state: s, internals } = createTableState({
          client: opts.client ?? client,
          query: {
            queryOnMount: opts.queryOnMount,
            blockQuery: opts.blockQuery,
            forceFilters: opts.forceFilters,
            forceSorters: opts.forceSorters,
            fn: opts.queryFn,
          },
          window: { blockSize: opts.blockSize },
        });
        state = s;
        initFn(internals);
        return () => h("div");
      },
    }),
  );
  return state;
}

/**
 * Mount `createTableState()` inside a stub component, auto-init with
 * `mockTableDef(columns)`. Default `queryOnMount: false` so the test can call
 * triggers explicitly without racing the bootstrap watcher.
 */
export function mountTableState(opts: MountTableStateOptions = {}): {
  state: ReactiveTableState;
  pagesFn: ReturnType<typeof vi.fn>;
  client: Client;
} {
  const { client, pagesFn, columns } = buildClient(opts, {
    data: [{ id: 1 }, { id: 2 }],
    count: 10,
  });
  const effective = { ...opts, queryOnMount: opts.queryOnMount ?? false };
  const state = mountWith(effective, client, ({ init }) => init(mockTableDef(columns)));
  return { state, pagesFn, client };
}

/**
 * Like `mountTableState` but does NOT call `internals.init()`. Returns an
 * `init()` callback so the test can assert pre-init state, then trigger init.
 */
export function mountTableStateDeferred(opts: MountTableStateOptions = {}): {
  state: ReactiveTableState;
  pagesFn: ReturnType<typeof vi.fn>;
  client: Client;
  init: (def?: TableDef) => void;
} {
  const { client, pagesFn, columns } = buildClient(opts, { data: [], count: 0 });
  let initRef!: (def: TableDef) => void;
  const state = mountWith(opts, client, ({ init }) => {
    initRef = init;
  });
  return {
    state,
    pagesFn,
    client,
    init: (def) => initRef(def ?? mockTableDef(columns)),
  };
}

/** Mount a stub component executing `fn()` in setup. */
export function mountSetup<T>(fn: () => T): T {
  let captured!: T;
  mount(
    defineComponent({
      setup() {
        captured = fn();
        return () => h("div");
      },
    }),
  );
  return captured;
}

/** Build a `KeyboardEvent("keydown")` with sensible defaults. */
export function kbd(opts: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent("keydown", { cancelable: true, ...opts });
}

/** Capture all `requestMainAction` payloads against `state`; returns the captured array + a dispose. */
export function captureMainActions(state: ReactiveTableState): {
  captured: MainActionRequest[];
  dispose: () => void;
} {
  const captured: MainActionRequest[] = [];
  const dispose = state.registerMainActionListener((req) => captured.push(req));
  return { captured, dispose };
}

/**
 * Seed `windowCache`/`results`/`totalCount` from an in-memory rows array so
 * tests can exercise active-row + selection behaviour without a real fetch.
 */
export function seedWindowCache(
  state: ReactiveTableState,
  rows: Record<string, unknown>[],
  totalCount = rows.length,
) {
  if (rows.length > 0) {
    const cache = new Map<number, Record<string, unknown>>();
    rows.forEach((r, i) => cache.set(i, r));
    state.windowCache.value = cache;
    state.results.value = rows;
  }
  state.totalCount.value = totalCount;
}
