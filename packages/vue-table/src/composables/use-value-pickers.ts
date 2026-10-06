import { ref, shallowReactive, shallowRef } from "vue";
import type { ShallowRef } from "vue";
import type { FilterExpr } from "@uniqu/core";
import type { ColumnDef, TableDef, ValueHelpInfo } from "@atscript/ui";
import { stableValueKey } from "@atscript/ui-table";
import {
  NUMERIC_VALUE_KINDS,
  fetchDistinctValues,
  getMetaEntry,
  isPickerDeclined,
} from "@atscript/ui";

type Row = Record<string, unknown>;

/**
 * What a picker needs of the table state: the loaded definition its caches hang
 * on, and the table's forced scope — a distinct picker offers only the values
 * the table itself can show.
 */
type PickerHost =
  | {
      tableDef: ShallowRef<TableDef | null>;
      forceFilters?: { value: FilterExpr | undefined };
    }
  | undefined;

/** One page of distinct values as picker rows (`__value` / `__label`), `count` sized for a window. */
export interface DistinctPage {
  data: Row[];
  count: number;
  page: number;
  itemsPerPage: number;
  pages: number;
}

/** The single "Value" column of an enum or distinct-values picker table (rows carry `__value` / `__label`). */
export function valueColumn(sortable: boolean): ColumnDef {
  return {
    path: "__label",
    label: "Value",
    type: "text",
    sortable,
    filterable: false,
    nullable: false,
    order: 0,
  };
}

/** How long an unsearched first page is reused (the inline field and the dialog share it). */
const PAGE1_TTL_MS = 30_000;

interface PickerStore {
  /** Dictionary pickers the server declined (4xx); reactive, so a field switches to free text. */
  declined: Set<string>;
  /** First page of each field's distinct values, by `url`, `field`, `size`. */
  page1: Map<string, { at: number; result: Promise<{ items: unknown[]; hasMore: boolean }> }>;
}

const createStore = (): PickerStore => ({ declined: shallowReactive(new Set()), page1: new Map() });

// Keyed by the loaded table definition: a table reload builds a new one, which
// drops what the picker learned (declines, cached pages) with it.
const stores = new WeakMap<TableDef, PickerStore>();

function storeOf(host: PickerHost): PickerStore {
  const def = host?.tableDef.value;
  if (!def) return createStore();
  let store = stores.get(def);
  if (!store) {
    store = createStore();
    stores.set(def, store);
  }
  return store;
}

const keyOf = (info: ValueHelpInfo) => `${info.url}\0${info.targetField}`;

/**
 * Whether `column` offers a value picker: literal options, the distinct values of
 * its own table, or a dictionary the server has not declined for this table —
 * and only on a column the server filters by value with the operators a picker
 * emits (`$eq` / `$in`): an existence-only (JSON-stored) column takes the
 * empty / not-empty input instead.
 */
export function hasValuePicker(host: PickerHost, column: ColumnDef): boolean {
  if (!column.filterable) return false;
  const ops = column.filterOps;
  if (ops && !(ops.includes("$eq") || ops.includes("$in"))) return false;
  if (column.options?.length || column.distinct) return true;
  const info = column.valueHelpInfo;
  return !!info && !storeOf(host).declined.has(keyOf(info));
}

/**
 * The dictionary answered 4xx (not readable for this caller): this table stops
 * offering that picker and the column takes free text. Anything else is no verdict.
 */
export function declineIfRejected(host: PickerHost, info: ValueHelpInfo, err: unknown): void {
  if (isPickerDeclined(err)) storeOf(host).declined.add(keyOf(info));
}

/**
 * Pager over the distinct values of `column.distinct`: `fetch(searchTerm, page, size)`
 * asks the table's controller via `$groupBy`. Values are ordered (and so paged) only
 * on a sortable column; otherwise the first `size` values are the whole list — search
 * narrows it. A 4xx rejects: the picker shows the error. An unsearched first page is
 * reused for a short while, so reopening a picker (or its dialog) does not re-ask.
 */
export function createDistinctPager(host: PickerHost, column: ColumnDef) {
  const { url, field } = column.distinct!;
  const numeric = column.valueKind !== undefined && NUMERIC_VALUE_KINDS.has(column.valueKind);
  const paged = column.sortable;

  return async function fetch(
    searchTerm: string,
    page: number,
    size: number,
  ): Promise<DistinctPage> {
    const text = searchTerm.trim();
    const skip = paged ? (page - 1) * size : 0;
    const empty = !paged && page > 1;
    // The table's forced scope narrows the values like it narrows the rows.
    const scope = host?.forceFilters?.value;
    const load = () =>
      fetchDistinctValues(getMetaEntry(url).client, field, {
        text,
        limit: size,
        skip,
        sortable: paged,
        numeric,
        filter: scope,
      });

    let result: { items: unknown[]; hasMore: boolean };
    if (empty) {
      result = { items: [], hasMore: false };
    } else if (text || page > 1) {
      result = await load();
    } else {
      const store = storeOf(host);
      const key = `${url}\0${field}\0${size}\0${scope ? stableValueKey(scope) : ""}`;
      let hit = store.page1.get(key);
      if (!hit || Date.now() - hit.at > PAGE1_TTL_MS) {
        const pending = load();
        hit = { at: Date.now(), result: pending };
        store.page1.set(key, hit);
        pending.catch(() => store.page1.delete(key)); // a failure is not cached
      }
      result = await hit.result;
    }

    const hasMore = paged && result.hasMore;
    const count = skip + result.items.length + (hasMore ? 1 : 0);
    return {
      data: result.items.map((v) => ({ __value: v, __label: String(v) })),
      count,
      page,
      itemsPerPage: size,
      pages: Math.max(1, Math.ceil(count / size)),
    };
  };
}

/**
 * Reactive state of an inline distinct-values dropdown over `pager`: the first
 * `shown` values of the first `size`, and how many exist (`count`, one past `size`
 * when more follow — the dialog pages the rest). A superseded search is dropped.
 */
export function useDistinctPicker(
  pager: ReturnType<typeof createDistinctPager>,
  size: number,
  shown: number,
) {
  const rows = shallowRef<Row[]>([]);
  const count = ref(0);
  /** More values exist past the first `size` (`count` is then one past `size`). */
  const more = ref(false);
  const querying = ref(false);
  const error = shallowRef<Error | null>(null);
  /** The first page arrived once — reopening the dropdown does not ask again. */
  const loaded = ref(false);
  let seq = 0;

  async function load(text: string) {
    const mine = ++seq;
    querying.value = true;
    try {
      const res = await pager(text, 1, size);
      if (mine !== seq) return;
      rows.value = res.data.slice(0, shown);
      count.value = res.count;
      more.value = res.count > size;
      error.value = null;
      loaded.value = true;
    } catch (err) {
      if (mine !== seq) return;
      rows.value = [];
      count.value = 0;
      more.value = false;
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      if (mine === seq) querying.value = false;
    }
  }

  return { rows, count, more, querying, error, loaded, load };
}
