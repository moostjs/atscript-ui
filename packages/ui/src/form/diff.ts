import { mergeStrategyPaths } from "@atscript/db/validator";
import {
  defineAnnotatedType,
  type TAtscriptAnnotatedType,
  type TAtscriptTypeObject,
} from "@atscript/typescript/utils";
import {
  DB_ENCRYPTED,
  DB_JSON,
  EXPECT_ARRAY_KEY,
  EXPECT_ARRAY_UNIQUE_ITEMS,
} from "../shared/annotation-keys";
import { getFieldMeta } from "../shared/field-resolver";
import { findVersionColumn } from "./create-form-def";
import { getByPath, isPlainObject } from "./path-utils";
import { hasNestedSkippedNavFields, omitSkippedNavFields } from "./skipped-nav";
import type { FormArrayFieldDef, FormDef, FormFieldDef, FormObjectFieldDef } from "./types";
import { isArrayField, isObjectField } from "./types";

// ── Public contract ──────────────────────────────────────────

/**
 * One field that differs between baseline and current.
 *
 * - `kind: 'set'` — scalar / object / union / tuple field whose value changed
 *   (including a clear-to-`null`). `before` / `after` are the whole values at
 *   `path`.
 * - `kind: 'array'` — array field whose membership or item content changed.
 *   `before` / `after` are the whole arrays.
 *
 * NOTE: `before` / `after` hold live references into the supplied `baseline` /
 * `current` containers — see {@link buildFormDiff} for the snapshot contract.
 */
export interface FormFieldChange {
  /** Dot-separated path relative to the form root (matches FormFieldDef.path). */
  path: string;
  kind: "set" | "array";
  before: unknown;
  after: unknown;
}

/** Options for {@link buildFormDiff}. */
export interface FormDiffOptions {
  /**
   * Optimistic-concurrency control. When `true` (default), a top-level
   * `$cas: { [versionColumn]: baselineVersion }` sibling is auto-included in
   * the patch whenever the form has a `@db.column.version` column AND the
   * patch is non-empty AND a baseline version value exists. `false` suppresses
   * it entirely.
   *
   * Independent of `$cas`, the `@db.column.version` column is ALWAYS excluded
   * from the SET diff: it is server-managed, and a direct write to it is
   * rejected by `@atscript/db` (`DbError('VERSION_COLUMN_WRITE')`). It is only
   * ever round-tripped through `$cas`.
   */
  cas?: boolean;
}

/** Result of {@link buildFormDiff}. */
export interface FormDiffResult {
  /** True when at least one field changed (revert-aware). */
  isDirty: boolean;
  /** Per-field changes (revert-aware — reverted fields are absent). */
  changes: FormFieldChange[];
  /**
   * `@atscript/db` patch object — flat, keyed by field name. Empty `{}` when
   * nothing changed. Carries a top-level `$cas` sibling when `opts.cas` is on
   * and a version column exists.
   */
  patch: Record<string, unknown>;
}

// ── Entry point ──────────────────────────────────────────────

/**
 * Diffs a form's `current` data against its `baseline` snapshot, producing both
 * a changed-fields list and an `@atscript/db` patch object.
 *
 * Both `baseline` and `current` are the WRAPPED form-data container
 * (`{ value: domainData }`) so this reuses {@link getByPath}.
 *
 * Revert-aware: a value edited back to its baseline produces no change and no
 * patch entry.
 *
 * Snapshot contract: the result is NOT a deep copy. `$insert` items, `$replace`
 * arrays, scalar leaf values, and `changes[].before/after` all hold live
 * references into `baseline` / `current`. Callers that keep editing the form
 * after building the patch must snapshot first (e.g. build the patch at submit
 * time on a frozen clone). This is the common Vue v-model flow.
 */
export function buildFormDiff(
  def: FormDef,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  opts?: FormDiffOptions,
): FormDiffResult {
  const changes: FormFieldChange[] = [];
  const patch: Record<string, unknown> = {};

  // A whole-value entry (an array's items, a replaced sub-object) must not
  // carry related rows of a navigation field the form leaves out. The root's
  // own navigation fields are no fields, so they never reach the patch.
  if (hasNestedSkippedNavFields(def)) {
    baseline = { ...baseline, value: omitSkippedNavFields(def, baseline.value) };
    current = { ...current, value: omitSkippedNavFields(def, current.value) };
  }

  // The `@db.column.version` column is server-managed: never emit it as a SET
  // (the DB rejects a direct write). Exclude it from the field walk regardless
  // of whether the caller passed `createFormDef(type, { versionColumn })`.
  const versionColumn = findVersionColumn(def.flatMap);

  if (def.type.type.kind === "object") {
    const mergePaths = mergeStrategyPaths(def.type);
    diffFields(def.fields, "", baseline, current, changes, patch, mergePaths, versionColumn);
  } else {
    diffLeafRoot(def, baseline, current, changes, patch);
  }

  // ── Optimistic concurrency ($cas) ──
  if ((opts?.cas ?? true) && versionColumn && Object.keys(patch).length > 0) {
    const baselineVersion = getByPath(baseline, versionColumn);
    // versioning.md: the version column MUST resolve to `int`. Only lift a
    // genuine integer into $cas — a string / non-integer / missing value is
    // rejected by db's `separateCas` (`DbError('INVALID_QUERY')`), so skip it
    // (matching the "missing baseline version → no $cas" behaviour).
    if (typeof baselineVersion === "number" && Number.isInteger(baselineVersion)) {
      patch.$cas = { [versionColumn]: baselineVersion };
    }
  }

  return { isDirty: changes.length > 0, changes, patch };
}

// ── Field walk ───────────────────────────────────────────────

/**
 * Diffs a list of sibling fields. `prefix` is the dot-path of the parent
 * context relative to the form root (used only for the change list `path`);
 * patch entries are written into the local `patch` object so callers can place
 * the whole sub-object as a nested partial.
 *
 * `mergePaths` is `mergeStrategyPaths` of `@atscript/db` for the form's type:
 * the form-root paths (a field's `fullPath`, no array indices) where the
 * server applies the merge strategy (atscript-db "Where Merge Applies"). An
 * object there may be sent in part, and a keyed array there merges its
 * `$update` items; every other object is sent whole.
 *
 * `versionColumn` is the top-level `@db.column.version` field name (or
 * undefined). When set, the matching top-level field is skipped entirely — it
 * is server-managed and may only be round-tripped via `$cas`.
 */
function diffFields(
  fields: FormFieldDef[],
  prefix: string,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  changes: FormFieldChange[],
  patch: Record<string, unknown>,
  mergePaths: ReadonlySet<string>,
  versionColumn?: string,
): void {
  for (const field of fields) {
    // Never a change, never a SET: phantoms (ui.action / paragraph) carry no
    // data, a derived column is server-computed (a written value is dropped),
    // the version column travels only via $cas.
    if (
      field.phantom ||
      field.derived ||
      (versionColumn !== undefined && !prefix && field.path === versionColumn)
    ) {
      continue;
    }

    const fullPath = prefix ? `${prefix}.${field.path}` : field.path;

    if (isArrayField(field)) {
      diffArrayField(field, fullPath, baseline, current, changes, patch, mergePaths);
      continue;
    }

    if (isObjectField(field)) {
      diffObjectField(field, fullPath, baseline, current, changes, patch, mergePaths);
      continue;
    }

    // Scalar / union / tuple / ref — compared & set as a whole value.
    diffScalarField(field, fullPath, baseline, current, changes, patch, mergePaths);
  }
}

/** The patch key of a single-leaf root form (non-object root): its patch is `{ value }`. */
const LEAF_ROOT_KEY = "value";

/** {@link leafRootMergePaths} per root type. */
const leafRootMergePathsByType = new WeakMap<TAtscriptAnnotatedType, ReadonlySet<string>>();

/**
 * `mergeStrategyPaths` of a single-leaf root form, read off the `{ value }`
 * shape of its patch. Cached per root type: building a type invalidates the
 * type caches of `@atscript/typescript`.
 */
function leafRootMergePaths(type: TAtscriptAnnotatedType): ReadonlySet<string> {
  let paths = leafRootMergePathsByType.get(type);
  if (!paths) {
    paths = mergeStrategyPaths(defineAnnotatedType("object").prop(LEAF_ROOT_KEY, type).$type);
    leafRootMergePathsByType.set(type, paths);
  }
  return paths;
}

/** Single-leaf root form (non-object root): its whole value is the patch's `value`. */
function diffLeafRoot(
  def: FormDef,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  changes: FormFieldChange[],
  patch: Record<string, unknown>,
): void {
  const field = def.rootField;
  const before = getByPath(baseline, "");
  const after = getByPath(current, "");
  if (deepEqual(before, after)) return;
  const mergePaths = leafRootMergePaths(def.type);
  if (isArrayField(field)) {
    const arrayPatch = diffArray(field, before, after, mergePaths.has(LEAF_ROOT_KEY));
    if (arrayPatch === undefined) return;
    changes.push({ path: "", kind: "array", before, after });
    patch[LEAF_ROOT_KEY] = arrayPatch;
  } else {
    changes.push({ path: "", kind: "set", before, after });
    patch[LEAF_ROOT_KEY] = wholeValue(LEAF_ROOT_KEY, before, after, mergePaths) ?? null;
  }
}

/** Scalar / union / tuple / ref field — whole-value compare; clear → null. */
function diffScalarField(
  field: FormFieldDef,
  fullPath: string,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  changes: FormFieldChange[],
  patch: Record<string, unknown>,
  mergePaths: ReadonlySet<string>,
): void {
  const before = getByPath(baseline, fullPath);
  const after = getByPath(current, fullPath);
  if (deepEqual(before, after)) return;

  changes.push({ path: fullPath, kind: "set", before, after });
  const value = wholeValue(fullPath, before, after, mergePaths) ?? null;
  setFieldPatch(field, fullPath, value, baseline, current, patch, mergePaths);
}

/**
 * Writes a changed field's patch `value` at its `field.path` in the local
 * `patch` (relative to the current context, so possibly dotted). A dotted
 * path runs through objects `createFormDef` dissolved into dot-paths; where
 * one of them is outside `mergePaths`, the patch may not carry part of it, so
 * the whole current object goes out at the SHALLOWEST such ancestor instead.
 */
function setFieldPatch(
  field: FormFieldDef,
  fullPath: string,
  value: unknown,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  mergePaths: ReadonlySet<string>,
): void {
  // The current context's own path: "" or ending in ".".
  const prefix = fullPath.slice(0, fullPath.length - field.path.length);
  for (let dot = field.path.indexOf("."); dot !== -1; dot = field.path.indexOf(".", dot + 1)) {
    const ancestor = field.path.slice(0, dot);
    const path = prefix + ancestor;
    if (mergePaths.has(path)) continue;
    const whole = wholeValue(path, getByPath(baseline, path), getByPath(current, path), mergePaths);
    setPatchLeaf(patch, ancestor, whole ?? null);
    return;
  }
  setPatchLeaf(patch, field.path, value);
}

/**
 * `after`, the current value at `path`, to send whole. The server still
 * merges every object inside it at a merge path — a merge object inside a
 * replaced one, a merge `T | null` field — and keeps the children a patch
 * leaves out there, so a child set in `before` and unset in `after` goes out
 * as `null`. Copies only the objects it changes; the rest stays a live
 * reference into `current`.
 */
function wholeValue(
  path: string,
  before: unknown,
  after: unknown,
  mergePaths: ReadonlySet<string>,
): unknown {
  if (mergePaths.size === 0 || !isPlainObject(before) || !isPlainObject(after)) return after;
  const merge = mergePaths.has(path);
  let out: Record<string, unknown> | undefined;
  for (const k of Object.keys(before)) {
    const value = after[k];
    const sent =
      merge && value === undefined && before[k] !== undefined && before[k] !== null
        ? null
        : wholeValue(`${path}.${k}`, before[k], value, mergePaths);
    if (sent !== value) (out ??= { ...after })[k] = sent;
  }
  return out ?? after;
}

/**
 * Inlined-or-structured object field — recurse, emit a nested partial OR the
 * whole sub-object.
 *
 * atscript-db's DEFAULT nested-object patch strategy is `replace` (strict —
 * every required child must be present, else 400; omitted optionals are
 * null-filled). A changed-leaves-only partial is a valid patch ONLY where the
 * merge strategy applies — the object's path is in `mergePaths`. Anywhere else
 * we emit the WHOLE current sub-object so the validator passes and no optional
 * leaf is silently nulled.
 *
 * Wholesale-clear: if the sub-object was a defined object in `baseline` but is
 * now undefined/null, emit `field: null` (object removed) instead of a partial
 * of nulled leaves.
 */
function diffObjectField(
  field: FormObjectFieldDef,
  fullPath: string,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  changes: FormFieldChange[],
  patch: Record<string, unknown>,
  mergePaths: ReadonlySet<string>,
): void {
  const beforeObj = getByPath(baseline, fullPath);
  const afterObj = getByPath(current, fullPath);
  // No object on either side: no leaf below differs (and neither side is a
  // removal). Also stops the walk at the data's depth on a recursive type,
  // whose def graph is cyclic.
  if (!isPlainObject(beforeObj) && !isPlainObject(afterObj)) return;

  // Single recursion populates `changes` AND the changed-leaves nested partial.
  // Version exclusion never applies below the root, so omit it.
  const nested: Record<string, unknown> = {};
  const changesBefore = changes.length;
  diffFields(field.objectDef.fields, fullPath, baseline, current, changes, nested, mergePaths);

  // Wholesale clear: object present in baseline, gone in current → field: null
  // (a single clear, not a partial of nulled leaves; per-leaf changes already
  // recorded by the recursion above). An object whose leaves are all unset
  // (`{}`, or every leaf `null`) has no leaf that differs — the removal itself
  // is then the change, so the form is dirty whenever the patch clears it.
  const cleared = (afterObj === undefined || afterObj === null) && isPlainObject(beforeObj);
  if (!cleared && Object.keys(nested).length === 0) return; // no change
  if (cleared && changes.length === changesBefore) {
    changes.push({ path: fullPath, kind: "set", before: beforeObj, after: afterObj });
  }
  const value =
    !cleared && mergePaths.has(fullPath)
      ? nested
      : (wholeValue(fullPath, beforeObj, afterObj, mergePaths) ?? null);
  setFieldPatch(field, fullPath, value, baseline, current, patch, mergePaths);
}

/**
 * Array field — keyed → $update/$insert/$remove; unkeyed → $replace. A
 * `@db.json` or `@db.encrypted` array is stored as one value (JSON /
 * ciphertext), which takes no array operations: it is sent whole (`null`
 * when cleared). An array inside a dissolved object the merge strategy does
 * not apply to is sent with that whole sub-object, like any leaf there.
 */
function diffArrayField(
  field: FormArrayFieldDef,
  fullPath: string,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  changes: FormFieldChange[],
  patch: Record<string, unknown>,
  mergePaths: ReadonlySet<string>,
): void {
  const before = getByPath(baseline, fullPath);
  const after = getByPath(current, fullPath);
  if (deepEqual(before, after)) return;

  const value =
    getFieldMeta(field.prop, DB_JSON) !== undefined ||
    getFieldMeta(field.prop, DB_ENCRYPTED) !== undefined
      ? (after ?? null)
      : diffArray(field, before, after, mergePaths.has(fullPath));
  // Guard against a no-op array patch (e.g. a keyed array missing from the
  // baseline and empty in the form: nothing to insert or remove). No real op →
  // no change recorded, no malformed `{}` emitted.
  if (value === undefined) return;

  changes.push({ path: fullPath, kind: "array", before, after });
  setFieldPatch(field, fullPath, value, baseline, current, patch, mergePaths);
}

// ── Array diffing ────────────────────────────────────────────

/**
 * Produces a `TArrayPatch` value for one array field, or `undefined` when no
 * real op results (the caller then skips the field entirely).
 *
 * - Keyed arrays (item object has `@expect.array.key`): `$update` / `$insert`
 *   / `$remove` when those operators reproduce the form's array, else
 *   `$replace` — see {@link diffKeyedArray}.
 * - Unkeyed object arrays / primitive arrays: `$replace` with the whole array.
 *   Primitive arrays with `@expect.array.uniqueItems` use by-value
 *   `$insert` / `$remove` (set semantics).
 *
 * Deliberate `$insert`-not-`$upsert`: wholly-new keyed items use `$insert`
 * (pure append) rather than `$upsert`. This is safe because `$insert` is only
 * ever used for keys ABSENT from baseline; existing keys go through `$update`.
 * `$upsert` would dedupe-by-key, which we don't need given that invariant.
 *
 * `merge`: the array's path is in `mergePaths` ({@link diffKeyedArray}).
 */
function diffArray(
  field: FormArrayFieldDef,
  before: unknown,
  after: unknown,
  merge: boolean,
): Record<string, unknown> | undefined {
  const beforeArr = Array.isArray(before) ? before : [];
  const afterArr = Array.isArray(after) ? after : [];

  const keyProps = getArrayKeyProps(field.itemType);
  if (keyProps.length > 0) {
    return diffKeyedArray(beforeArr, afterArr, keyProps, merge);
  }

  // Primitive uniqueItems → set semantics (by value).
  if (getFieldMeta(field.prop, EXPECT_ARRAY_UNIQUE_ITEMS) !== undefined && isPrimitiveItem(field)) {
    const setPatch = diffUniqueArray(beforeArr, afterArr);
    if (setPatch) return setPatch;
  }

  // Unkeyed / primitive → replace the whole array.
  return { $replace: afterArr };
}

/**
 * Keyed array diff: `$update` / `$insert` / `$remove` when those operators
 * reproduce the form's array, else `{ $replace: after }`. Returns `undefined`
 * when nothing changed (same order, no op), so the caller skips the field
 * rather than emitting a malformed empty `{}`.
 *
 * Order: the db applies the operators remove → update (in place) → insert
 * (appended, in item order), so the array it ends with holds the baseline
 * elements whose key is still present, in baseline order, followed by the
 * `$insert` items. When that key sequence differs from the form's, the
 * operators cannot express the form state and `$replace` is the only faithful
 * patch — a reorder, a new row placed before an existing one, an edited key on
 * a row that is not last (its remove + insert would move it to the end), a row
 * removed and re-added under the same key elsewhere. A new row appended at the
 * end and an edited key on the last row stay key operators.
 *
 * A `$update` item follows the array field's patch strategy (`merge` is
 * whether the merge strategy applies to the array), which the db applies to
 * it: by default (replace) the db replaces the matched element, so the item is
 * the whole current element minus its `undefined`-valued props; under `merge`
 * the db shallow-merges the item in, so it is the key + the changed top-level
 * leaves, a cleared leaf as `null` ({@link buildKeyedUpdate}). A nested object
 * of an element is sent whole either way: no merge strategy applies inside an
 * array element. An item is emitted only when some leaf changed.
 *
 * Fallbacks to `{ $replace: after }`, the only faithful op, when:
 * - key identity is ambiguous — an element that is not an object or lacks ALL
 *   of its key values, or a key shared by two elements on one side (a
 *   last-write-wins collapse would silently drop items);
 * - an element a key operator would name (a `$update`, `$remove` or `$insert`
 *   item) lacks ANY of its key values (`undefined` / `null`): the db refuses
 *   such an item (`PATCH_KEY_REQUIRED` for `$update` / `$remove`), while under
 *   `$replace` it validates the array and reports the missing field on its
 *   own path. An untouched row with an incomplete key names no operator, so
 *   it does not turn an unrelated edit into a `$replace`.
 */
function diffKeyedArray(
  before: unknown[],
  after: unknown[],
  keyProps: string[],
  merge: boolean,
): Record<string, unknown> | undefined {
  const beforeByKey = byKey(before, keyProps);
  const afterByKey = byKey(after, keyProps);
  if (!beforeByKey || !afterByKey) return { $replace: after };
  const incomplete = (el: Record<string, unknown>) =>
    keyProps.some((k) => el[k] === undefined || el[k] === null);

  // One pass over the baseline: a key gone from the form is a remove; a kept
  // key must hold the next place of the form's key sequence (the order check),
  // and is an update when its element changed. The form's keys after the kept
  // ones are then all absent from the baseline — the inserts, in their order.
  const afterKeys = [...afterByKey.keys()];
  const $update: Record<string, unknown>[] = [];
  const $remove: Record<string, unknown>[] = [];
  let kept = 0;
  for (const [k, prev] of beforeByKey) {
    const el = afterByKey.get(k);
    if (el === undefined) {
      if (incomplete(prev)) return { $replace: after };
      $remove.push(pickKeys(prev, keyProps));
      continue;
    }
    if (afterKeys[kept++] !== k) return { $replace: after };
    if (deepEqual(prev, el)) continue;
    const partial = buildKeyedUpdate(prev, el, keyProps);
    if (!partial) continue;
    if (incomplete(el)) return { $replace: after };
    $update.push(merge ? partial : definedProps(el));
  }
  const $insert = afterKeys.slice(kept).map((k) => afterByKey.get(k)!);
  if ($insert.some(incomplete)) return { $replace: after };

  // No real op (e.g. both arrays empty, the baseline one missing) → undefined
  // so the caller skips the field.
  return arrayOps({ $update, $insert, $remove });
}

/**
 * Builds a `$update` partial: key fields + changed leaves only (a cleared leaf
 * as `null`), or `undefined` when no leaf changed. A leaf is a top-level prop
 * of the element, compared by value: an explicit `undefined`-valued prop
 * equals an absent one, and a changed nested object is sent whole (the db
 * merges an item one level deep).
 */
function buildKeyedUpdate(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  keyProps: string[],
): Record<string, unknown> | undefined {
  const partial = pickKeys(next, keyProps);

  let changed = false;
  // Union of own keys across both sides — catches cleared (gone in next) leaves.
  const allKeys = new Set<string>([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of allKeys) {
    if (keyProps.includes(k)) continue;
    const a = prev[k];
    const b = next[k];
    if (!deepEqual(a, b)) {
      partial[k] = b === undefined ? null : b;
      changed = true;
    }
  }
  return changed ? partial : undefined;
}

/**
 * Shallow copy of `el` without its `undefined`-valued own props (top level
 * only; nested values are kept by reference).
 */
function definedProps(el: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(el)) {
    if (el[k] !== undefined) out[k] = el[k];
  }
  return out;
}

/** Primitive uniqueItems set diff. Returns undefined if neither side differs. */
function diffUniqueArray(before: unknown[], after: unknown[]): Record<string, unknown> | undefined {
  const beforeSet = new Set(before.map((v) => stableKey(v)));
  const afterSet = new Set(after.map((v) => stableKey(v)));

  const $insert: unknown[] = [];
  const $remove: unknown[] = [];
  const seenInsert = new Set<string>();
  const seenRemove = new Set<string>();

  for (const v of after) {
    const k = stableKey(v);
    if (!beforeSet.has(k) && !seenInsert.has(k)) {
      $insert.push(v);
      seenInsert.add(k);
    }
  }
  for (const v of before) {
    const k = stableKey(v);
    if (!afterSet.has(k) && !seenRemove.has(k)) {
      $remove.push(v);
      seenRemove.add(k);
    }
  }

  return arrayOps({ $insert, $remove });
}

/**
 * Assembles a `TArrayPatch` from named op-arrays, dropping empty ones. Returns
 * `undefined` when no op carries any item, so the caller skips the field rather
 * than emitting a malformed empty `{}`.
 */
function arrayOps(ops: Record<string, unknown[]>): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};
  for (const k in ops) {
    if (ops[k]!.length > 0) result[k] = ops[k];
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ── Helpers ──────────────────────────────────────────────────

/** Reads `@expect.array.key` props from an array item's object type. */
function getArrayKeyProps(itemType: TAtscriptAnnotatedType): string[] {
  if (itemType.type.kind !== "object") return [];
  const props = (itemType.type as TAtscriptTypeObject).props;
  const keys: string[] = [];
  for (const [name, prop] of props.entries()) {
    if (getFieldMeta(prop, EXPECT_ARRAY_KEY) !== undefined) {
      keys.push(name);
    }
  }
  return keys;
}

/** True when the array's item type is a primitive (designType, kind === ''). */
function isPrimitiveItem(field: FormArrayFieldDef): boolean {
  return field.itemType.type.kind === "";
}

/**
 * The elements by {@link keyOf} bucket, or `undefined` when key identity is
 * ambiguous: an element is not an object or lacks ALL of its key values
 * (`undefined` / `null`), or two elements share a key (a Map collapse would
 * silently lose one).
 */
function byKey(
  arr: unknown[],
  keyProps: string[],
): Map<string, Record<string, unknown>> | undefined {
  const map = new Map<string, Record<string, unknown>>();
  for (const el of arr) {
    if (!isPlainObject(el) || keyProps.every((k) => el[k] === undefined || el[k] === null)) {
      return undefined;
    }
    map.set(keyOf(el, keyProps), el);
  }
  return map.size === arr.length ? map : undefined;
}

/**
 * Bucket string for a keyed-array element's key values, type-strict like
 * {@link stableKey}. A composite key is the JSON array of its tagged values,
 * so no two different key tuples share a bucket (a joined string would: the
 * values may contain the separator).
 */
function keyOf(el: Record<string, unknown>, keyProps: string[]): string {
  if (keyProps.length === 1) return stableKey(el[keyProps[0]!]);
  return JSON.stringify(keyProps.map((k) => stableKey(el[k])));
}

/** Picks only the key fields from an element (for $remove). */
function pickKeys(el: Record<string, unknown>, keyProps: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keyProps) out[k] = el[k];
  return out;
}

/** Writes a value into a (possibly dotted) leaf path on a local patch object. */
function setPatchLeaf(patch: Record<string, unknown>, path: string, value: unknown): void {
  if (!path.includes(".")) {
    patch[path] = value;
    return;
  }
  const keys = path.split(".");
  const last = keys.pop()!;
  let cur = patch;
  for (const k of keys) {
    let next = cur[k];
    if (next === undefined || next === null || typeof next !== "object") {
      next = {};
      cur[k] = next;
    }
    cur = next as Record<string, unknown>;
  }
  cur[last] = value;
}

/**
 * Stable string key for primitives / values (used for set membership).
 *
 * Key equality is TYPE-STRICT: a number `1` and a string `'1'` produce
 * distinct keys, so a keyed-array item whose key changes JS representation
 * between baseline and current is treated as a remove + insert. Callers that
 * round-trip keys with loose typing should normalise the key type first.
 */
function stableKey(v: unknown): string {
  if (typeof v === "string") return `s:${v}`;
  if (typeof v === "number" || typeof v === "boolean") return `p:${String(v)}`;
  if (v === null) return "null";
  if (v === undefined) return "undef";
  return `j:${JSON.stringify(v)}`;
}

/**
 * Structural deep equality (order-sensitive for arrays). `NaN` equals `NaN`
 * (revert-aware for NaN scalars) while `0` / `-0` stay equal (matches DB
 * intent — `===` treats them equal, only NaN is special-cased).
 *
 * Unset is one value: `null`, `undefined` and an absent object prop are equal
 * at any depth — a field loaded as `null` (SQL `NULL`) that the form holds as
 * `undefined`, or an optional prop emptied to `undefined` in an array row, is
 * unchanged. The patch cannot tell them apart either: it sends a cleared value
 * as `null`.
 *
 * The single comparator shared across the form engine: diff, conflict
 * detection ({@link buildFormRebase}), and apply all route through this — never
 * reimplement equality elsewhere.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined);
  }
  // NaN: `===` is false but a value reverted to a NaN baseline is unchanged.
  if (typeof a === "number" && typeof b === "number") return Number.isNaN(a) && Number.isNaN(b);
  if (typeof a !== "object" || typeof b !== "object") return false;

  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) return false;
  if (aIsArr && bIsArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  // An absent prop reads as `undefined`, so it equals one that is unset.
  for (const k of Object.keys(ao)) {
    if (!deepEqual(ao[k], Object.hasOwn(bo, k) ? bo[k] : undefined)) return false;
  }
  for (const k of Object.keys(bo)) {
    if (!Object.hasOwn(ao, k) && bo[k] !== undefined && bo[k] !== null) return false;
  }
  return true;
}
