import { splitUrlSegments } from "@uniqu/url";
import {
  stateToUrlQueryString,
  urlQueryConsumesKey,
  type UrlQueryDefaults,
  type UrlQueryStateLike,
} from "./url-query";

/**
 * A route query record — the shape a router takes for `{ query }`
 * (vue-router's `LocationQueryRaw` subset). A key with no value is `null`; a
 * repeated key is an array in order.
 * @since 0.1.148
 */
export type UrlQueryRecord = Record<string, string | null | (string | null)[]>;

/**
 * What the record helpers read — a router's resolved query fits as is
 * (vue-router's `LocationQuery`).
 * @since 0.1.148
 */
export type UrlQueryRecordInput = Readonly<
  Record<string, string | null | readonly (string | null)[] | undefined>
>;

/** @since 0.1.148 */
export interface UrlQueryRecordOptions {
  /** Namespace: own keys are `<prefix>.<key>`. Same meaning as the bridge's `prefix`. */
  prefix?: string;
  /**
   * Host keys (wire form) the table never reads, writes or removes, even when
   * a column has the same name. A key also covers the operator forms of that
   * field (`status!='x'`). A table segment on such a key is withheld from the
   * record (see {@link mergeUrlQueryRecord}). Since 0.1.148.
   */
  preserveKeys?: readonly string[] | ((key: string) => boolean);
}

const KEY_CHAR = /[A-Za-z0-9_.$-]/;

/**
 * Index of `=` if every char before it is URL-key-safe. Returns -1 when any
 * non-key char (uniqu operator, whitespace, etc.) appears first — those
 * segments must round-trip as a single bare key because a router's `query`
 * record has no encoding for non-`=` separators.
 */
function findCleanEq(segment: string): number {
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (c === "=") return i > 0 ? i : -1;
    if (!KEY_CHAR.test(c)) return -1;
  }
  return -1;
}

/**
 * The leading run of URL-key-safe characters — the field name of an
 * operator-bearing key (`status!='x'` → `status`).
 * @internal
 */
export function leadingKey(key: string): string {
  let i = 0;
  while (i < key.length && KEY_CHAR.test(key[i])) i++;
  return key.slice(0, i);
}

type KeyPredicate = (wireKey: string) => boolean;

// Built once per `preserveKeys` value, so a bridge that passes the same option
// to every call does not rebuild its key set each time.
const predicates = new WeakMap<object, KeyPredicate>();

function preservedPredicate(opts: UrlQueryRecordOptions | undefined): KeyPredicate {
  const keys = opts?.preserveKeys;
  if (!keys) return () => false;
  let predicate = predicates.get(keys);
  if (!predicate) {
    const set = typeof keys === "function" ? undefined : new Set(keys);
    const matches = (key: string) => (set ? set.has(key) : (keys as (key: string) => boolean)(key));
    predicate = (wireKey) => matches(wireKey) || matches(leadingKey(wireKey));
    predicates.set(keys, predicate);
  }
  return predicate;
}

function prefixOf(opts: UrlQueryRecordOptions | undefined): string {
  return opts?.prefix ? `${opts.prefix}.` : "";
}

/** A table segment as a record entry: wire key + value (`null` for a bare key). */
function segmentEntry(segment: string, prefix: string): [string, string | null] {
  const eq = findCleanEq(segment);
  return eq > 0
    ? [`${prefix}${segment.slice(0, eq)}`, segment.slice(eq + 1)]
    : [`${prefix}${segment}`, null];
}

function pushValue(record: UrlQueryRecord, key: string, value: string | null): void {
  const prior = record[key];
  if (prior === undefined) record[key] = value;
  else if (Array.isArray(prior)) prior.push(value);
  else record[key] = [prior, value];
}

/** The entries of a table query string, split into those it may write and those on a preserved key. */
function splitSegments(
  urlString: string,
  prefix: string,
  preserved: KeyPredicate,
): { block: UrlQueryRecord; withheld: string[] } {
  const block: UrlQueryRecord = {};
  const withheld: string[] = [];
  for (const segment of splitUrlSegments(urlString)) {
    if (!segment) continue;
    const [key, value] = segmentEntry(segment, prefix);
    if (preserved(key)) withheld.push(segment);
    else pushValue(block, key, value);
  }
  return { block, withheld };
}

/**
 * A table query string as its own record entries: keys carry the `prefix`, a
 * repeated key becomes an array (order kept), a segment with no `=` (an
 * operator-bearing filter, a bare control) is a `null`-valued key. Segments on
 * a preserved key are left out.
 * @internal Use `stateToUrlQueryRecord` for links.
 */
export function urlQueryStringToRecord(
  urlString: string,
  opts?: UrlQueryRecordOptions,
): UrlQueryRecord {
  return splitSegments(urlString, prefixOf(opts), preservedPredicate(opts)).block;
}

/**
 * A route query as the table's query string — what `<AsTableRoot
 * v-model:url-query>` reads. Keys outside the `prefix` and preserved keys are
 * skipped; arrays are expanded.
 * @since 0.1.148
 */
export function urlQueryRecordToString(
  query: UrlQueryRecordInput,
  opts?: UrlQueryRecordOptions,
): string {
  const prefix = prefixOf(opts);
  const preserved = preservedPredicate(opts);
  const parts: string[] = [];
  for (const key in query) {
    if (prefix && !key.startsWith(prefix)) continue;
    if (preserved(key)) continue;
    const own = prefix ? key.slice(prefix.length) : key;
    const v = query[key];
    if (v === undefined) continue;
    if (v === null) parts.push(own);
    else if (typeof v === "string") parts.push(`${own}=${v}`);
    else for (const item of v) parts.push(item === null ? own : `${own}=${item}`);
  }
  return parts.join("&");
}

/**
 * The record for a table state — for links:
 * `<RouterLink :to="{ query: stateToUrlQueryRecord(state, defaults) }">`.
 * Same content as {@link stateToUrlQueryString}, in router form.
 * @since 0.1.148
 */
export function stateToUrlQueryRecord(
  state: UrlQueryStateLike,
  defaults: UrlQueryDefaults,
  opts?: UrlQueryRecordOptions,
): UrlQueryRecord {
  return urlQueryStringToRecord(stateToUrlQueryString(state, defaults), opts);
}

/**
 * Merge a table query string into `current`. Foreign keys keep their slots;
 * own keys are rewritten as one block where the first own key sat (else at the
 * end) in the table's order; own keys absent from `urlString` are removed;
 * preserved keys are kept verbatim.
 *
 * A table segment on a preserved key is **withheld**: it is not written (the
 * host's value stays) and its table-form segment is returned in `withheld`.
 * `own` lists the wire keys the table wrote.
 *
 * `isOwn` decides ownership of a wire key (default: under the prefix, or a
 * key the table's parser consumes — see {@link urlQueryConsumesKey}); a
 * preserved key is never own.
 * @internal The bridge behind `useTableUrlQuery`.
 */
export function mergeUrlQueryRecord(
  current: UrlQueryRecordInput,
  urlString: string,
  opts?: UrlQueryRecordOptions & { isOwn?: (wireKey: string) => boolean },
): { query: UrlQueryRecord; withheld: string[]; own: string[] } {
  const prefix = prefixOf(opts);
  const preserved = preservedPredicate(opts);
  const isOwn =
    opts?.isOwn ?? ((key: string) => (prefix ? key.startsWith(prefix) : urlQueryConsumesKey(key)));

  const { block, withheld } = splitSegments(urlString, prefix, preserved);

  const query: UrlQueryRecord = {};
  let placed = false;
  const place = () => {
    if (placed) return;
    placed = true;
    Object.assign(query, block);
  };
  for (const key in current) {
    const value = current[key];
    if (value === undefined) continue;
    if (!preserved(key) && isOwn(key)) place();
    else query[key] = Array.isArray(value) ? [...value] : (value as string | null);
  }
  place();
  return { query, withheld, own: Object.keys(block) };
}
