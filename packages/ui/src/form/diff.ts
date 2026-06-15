import type { TAtscriptAnnotatedType, TAtscriptTypeObject } from "@atscript/typescript/utils";
import {
  DB_COLUMN_VERSION,
  DB_PATCH_STRATEGY,
  EXPECT_ARRAY_KEY,
  EXPECT_ARRAY_UNIQUE_ITEMS,
} from "../shared/annotation-keys";
import { getFieldMeta } from "../shared/field-resolver";
import { getByPath } from "./path-utils";
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

  // The `@db.column.version` column is server-managed: never emit it as a SET
  // (the DB rejects a direct write). Exclude it from the field walk regardless
  // of whether the caller passed `createFormDef(type, { versionColumn })`.
  const versionColumn = findVersionColumn(def);

  diffFields(def.fields, "", baseline, current, changes, patch, versionColumn, def.flatMap);

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
 * `versionColumn` is the top-level `@db.column.version` field name (or
 * undefined). When set, the matching top-level field is skipped entirely — it
 * is server-managed and may only be round-tripped via `$cas`.
 *
 * `inlineFlatMap` is the form's `flatMap`, supplied only at the top-level walk.
 * It lets {@link diffScalarField} read `@db.patch.strategy` off the object
 * ancestors of an INLINED leaf (a dotted-path leaf with no `FormObjectFieldDef`
 * node — `createFormDef` dissolves unlabelled objects into dot-paths). At a
 * default (replace) ancestor the whole sub-object must be emitted. It is
 * intentionally NOT propagated into `diffObjectField` recursion, where the
 * strategy decision is already made per structured object.
 */
function diffFields(
  fields: FormFieldDef[],
  prefix: string,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  changes: FormFieldChange[],
  patch: Record<string, unknown>,
  versionColumn?: string,
  inlineFlatMap?: Map<string, TAtscriptAnnotatedType>,
): void {
  for (const field of fields) {
    // Single-leaf root form (non-object root) has exactly one field with
    // path '' — diff the entire domain value as one scalar/array.
    if (field.path === "" && fields.length === 1) {
      diffLeafRoot(field, baseline, current, changes, patch);
      continue;
    }
    if (field.phantom) continue; // ui.action / paragraph — no data

    // Version column: server-managed, never a SET (only via $cas).
    if (versionColumn !== undefined && !prefix && field.path === versionColumn) continue;

    const fullPath = prefix ? `${prefix}.${field.path}` : field.path;

    if (isArrayField(field)) {
      diffArrayField(field, fullPath, baseline, current, changes, patch);
      continue;
    }

    if (isObjectField(field)) {
      diffObjectField(field, fullPath, baseline, current, changes, patch);
      continue;
    }

    // Scalar / union / tuple / ref — compared & set as a whole value.
    diffScalarField(field, fullPath, baseline, current, changes, patch, inlineFlatMap);
  }
}

/** Single-leaf root form (non-object root). Whole value is the patch. */
function diffLeafRoot(
  field: FormFieldDef,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  changes: FormFieldChange[],
  patch: Record<string, unknown>,
): void {
  const before = getByPath(baseline, "");
  const after = getByPath(current, "");
  if (deepEqual(before, after)) return;
  if (isArrayField(field)) {
    const arrayPatch = diffArray(field, before, after);
    if (arrayPatch === undefined) return;
    changes.push({ path: "", kind: "array", before, after });
    patch.value = arrayPatch;
  } else {
    changes.push({ path: "", kind: "set", before, after });
    patch.value = after === undefined ? null : after;
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
  inlineFlatMap?: Map<string, TAtscriptAnnotatedType>,
): void {
  const before = getByPath(baseline, fullPath);
  const after = getByPath(current, fullPath);
  if (deepEqual(before, after)) return;

  changes.push({ path: fullPath, kind: "set", before, after });

  // Inlined-object replace cutoff: a dotted leaf came from an object that
  // `createFormDef` dissolved into dot-paths. atscript-db's default nested
  // strategy is `replace` (the whole sub-object must be present), so emit the
  // whole sub-object at the SHALLOWEST default-replace ancestor. Merge ancestors
  // pass through (partial); `@db.column.version` exclusion already happened.
  if (inlineFlatMap && field.path.includes(".")) {
    const cutoff = inlinedReplaceCutoff(field.path, inlineFlatMap);
    if (cutoff !== undefined) {
      // `cutoff` is relative to the current context (matches `field.path` and
      // the local `patch`). The data read-path needs the full prefix.
      const prefixLen = fullPath.length - field.path.length; // includes trailing "."
      const readPath = prefixLen > 0 ? fullPath.slice(0, prefixLen) + cutoff : cutoff;
      const sub = getByPath(current, readPath);
      setPatchLeaf(patch, cutoff, sub === undefined ? null : sub);
      return;
    }
  }

  // Patch leaf path is relative to the local patch object — `field.path` keeps
  // the dotted nesting inside the current context.
  setPatchLeaf(patch, field.path, after === undefined ? null : after);
}

/**
 * For a dotted INLINED leaf path, returns the path of the shallowest object
 * ancestor whose `@db.patch.strategy` is the default (`replace`), or undefined
 * when every ancestor is `merge` (then the leaf partial is correct). At a
 * replace ancestor the whole sub-object must be present in the patch.
 *
 * Walks ancestor segments (`a`, `a.b`, … but not the leaf itself); the first
 * one that is an object AND not merge is the cutoff. merge does NOT propagate,
 * so a default-replace level below a merge level still cuts off there.
 */
function inlinedReplaceCutoff(
  leafPath: string,
  flatMap: Map<string, TAtscriptAnnotatedType>,
): string | undefined {
  const segs = leafPath.split(".");
  let acc = "";
  for (let i = 0; i < segs.length - 1; i++) {
    acc = acc ? `${acc}.${segs[i]}` : segs[i]!;
    const prop = flatMap.get(acc);
    if (!prop || prop.type.kind !== "object") continue;
    if (getFieldMeta(prop, DB_PATCH_STRATEGY) !== "merge") return acc;
  }
  return undefined;
}

/**
 * Inlined-or-structured object field — recurse, emit a nested partial OR the
 * whole sub-object depending on the field's `@db.patch.strategy`.
 *
 * atscript-db's DEFAULT nested-object patch strategy is `replace` (strict —
 * every required child must be present, else 400; omitted optionals are
 * null-filled). A changed-leaves-only partial is a valid patch ONLY when the
 * object field carries `@db.patch.strategy 'merge'`. For the default (replace)
 * case we therefore emit the WHOLE current sub-object so the validator passes
 * and no optional leaf is silently nulled. `merge` does NOT propagate, so a
 * descendant object without its own `merge` again emits its full sub-object
 * (handled by recursion — `diffFields` re-enters this function per child).
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
): void {
  const beforeObj = getByPath(baseline, fullPath);
  const afterObj = getByPath(current, fullPath);

  // Single recursion populates `changes` AND the changed-leaves nested partial.
  // Pass the child objectDef's flatMap so an INLINED default-replace sub-object
  // nested below emits its whole sub-object (merge does NOT propagate). Version
  // exclusion never applies below the root, so omit it.
  const nested: Record<string, unknown> = {};
  diffFields(
    field.objectDef.fields,
    fullPath,
    baseline,
    current,
    changes,
    nested,
    undefined,
    field.objectDef.flatMap,
  );

  // Wholesale clear: object present in baseline, gone in current → field: null
  // (a single clear, not a partial of nulled leaves; per-leaf changes already
  // recorded by the recursion above).
  if ((afterObj === undefined || afterObj === null) && isPlainObject(beforeObj)) {
    setPatchLeaf(patch, field.path, null);
    return;
  }

  if (Object.keys(nested).length === 0) return; // no change

  // Merge strategy → emit the changed-leaves-only nested partial. Default
  // (replace) strategy → emit the WHOLE current sub-object (all leaves, changed
  // or not) so atscript-db's strict replace validator passes and no optional
  // leaf is silently nulled. `merge` does NOT propagate, so a descendant object
  // without its own `merge` again emits its full sub-object (via recursion).
  if (getFieldMeta(field.prop, DB_PATCH_STRATEGY) === "merge") {
    setPatchLeaf(patch, field.path, nested);
  } else {
    setPatchLeaf(patch, field.path, afterObj === undefined ? null : afterObj);
  }
}

/** Array field — keyed → $update/$insert/$remove; unkeyed → $replace. */
function diffArrayField(
  field: FormArrayFieldDef,
  fullPath: string,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  changes: FormFieldChange[],
  patch: Record<string, unknown>,
): void {
  const before = getByPath(baseline, fullPath);
  const after = getByPath(current, fullPath);
  if (deepEqual(before, after)) return;

  const arrayPatch = diffArray(field, before, after);
  // Guard against a no-op array patch (e.g. items differ only by an explicit
  // `undefined`-valued prop that the keyed diff treats as equal). No real op →
  // no change recorded, no malformed `{}` emitted.
  if (arrayPatch === undefined) return;

  changes.push({ path: fullPath, kind: "array", before, after });
  setPatchLeaf(patch, field.path, arrayPatch);
}

// ── Array diffing ────────────────────────────────────────────

/**
 * Produces a `TArrayPatch` value for one array field, or `undefined` when no
 * real op results (the caller then skips the field entirely).
 *
 * - Keyed arrays (item object has `@expect.array.key`): emit `$update`
 *   (key + changed leaves), `$insert` (wholly-new items, whole), `$remove`
 *   (key only). Reorder-only (same key membership, same content, different
 *   order) → `$replace` (key-ops can't express a pure reorder).
 *   Ambiguous keys (duplicate or missing key values) → `$replace` (the only
 *   faithful op when key identity is unreliable).
 * - Unkeyed object arrays / primitive arrays: `$replace` with the whole array.
 *   Primitive arrays with `@expect.array.uniqueItems` use by-value
 *   `$insert` / `$remove` (set semantics).
 *
 * Deliberate `$insert`-not-`$upsert`: wholly-new keyed items use `$insert`
 * (pure append) rather than `$upsert`. This is safe because `$insert` is only
 * ever used for keys ABSENT from baseline; existing keys go through `$update`.
 * `$upsert` would dedupe-by-key, which we don't need given that invariant.
 */
function diffArray(
  field: FormArrayFieldDef,
  before: unknown,
  after: unknown,
): Record<string, unknown> | undefined {
  const beforeArr = Array.isArray(before) ? before : [];
  const afterArr = Array.isArray(after) ? after : [];

  const keyProps = getArrayKeyProps(field.itemType);
  if (keyProps.length > 0) {
    return diffKeyedArray(beforeArr, afterArr, keyProps);
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
 * Keyed array diff. Reorder-only (same membership) falls back to $replace.
 *
 * Returns `undefined` when no $update/$insert/$remove op is produced (so the
 * caller skips the field rather than emitting a malformed empty `{}`).
 *
 * Ambiguity fallback: if either side has DUPLICATE key buckets, or ANY element
 * is missing all of its key values, key identity is unreliable — fall back to
 * `{ $replace: after }`, the only faithful op (last-write-wins collapse would
 * silently drop items, and a key-less `$update` is unmatchable by the DB).
 */
function diffKeyedArray(
  before: unknown[],
  after: unknown[],
  keyProps: string[],
): Record<string, unknown> | undefined {
  // Detect un-keyable elements (missing all key values) on either side.
  if (hasKeylessItem(before, keyProps) || hasKeylessItem(after, keyProps)) {
    return { $replace: after };
  }

  const beforeByKey = new Map<string, Record<string, unknown>>();
  for (const el of before) {
    if (isPlainObject(el)) beforeByKey.set(keyOf(el, keyProps), el);
  }
  const afterByKey = new Map<string, Record<string, unknown>>();
  for (const el of after) {
    if (isPlainObject(el)) afterByKey.set(keyOf(el, keyProps), el);
  }

  // Duplicate keys on either side → ambiguous identity. Map collapse would
  // silently lose items, so $replace is the only faithful op.
  if (beforeByKey.size !== before.length || afterByKey.size !== after.length) {
    return { $replace: after };
  }

  // Reorder-only detection: identical key sets AND every matched item deep-equal
  // → membership/content unchanged, only order differs. db arrays are ordered
  // and key-ops can't express a pure reorder, so $replace is the only faithful op.
  if (beforeByKey.size === afterByKey.size) {
    let sameMembershipAndContent = true;
    for (const [k, el] of afterByKey) {
      const prev = beforeByKey.get(k);
      if (prev === undefined || !deepEqual(prev, el)) {
        sameMembershipAndContent = false;
        break;
      }
    }
    if (sameMembershipAndContent) {
      // Same keys + same content but the diff fired → order changed.
      return { $replace: after };
    }
  }

  const $insert: unknown[] = [];
  const $update: Record<string, unknown>[] = [];
  const $remove: Record<string, unknown>[] = [];

  // Inserts + updates from the after side.
  for (const [k, el] of afterByKey) {
    const prev = beforeByKey.get(k);
    if (prev === undefined) {
      $insert.push(el); // wholly-new item (key absent from baseline)
      continue;
    }
    if (!deepEqual(prev, el)) {
      // Partial: key fields + only the changed leaves.
      const partial = buildKeyedUpdate(prev, el, keyProps);
      if (partial) $update.push(partial);
    }
  }

  // Removals: keys present in before but gone from after.
  for (const [k, el] of beforeByKey) {
    if (!afterByKey.has(k)) {
      $remove.push(pickKeys(el, keyProps));
    }
  }

  // No real op (e.g. the only diff was an explicit undefined-valued prop the
  // keyed update treats as equal) → undefined so the caller skips the field.
  return arrayOps({ $update, $insert, $remove });
}

/** Builds a `$update` partial: key fields + changed leaves only. */
function buildKeyedUpdate(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  keyProps: string[],
): Record<string, unknown> | undefined {
  const partial: Record<string, unknown> = {};
  for (const k of keyProps) partial[k] = next[k];

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

/** Finds the form's `@db.column.version` column name, if any (top-level only). */
function findVersionColumn(def: FormDef): string | undefined {
  for (const [path, prop] of def.flatMap.entries()) {
    if (!path || path.includes(".")) continue;
    if (getFieldMeta(prop, DB_COLUMN_VERSION) !== undefined) {
      return path;
    }
  }
  return undefined;
}

/** True when any element lacks ALL of its key values (un-keyable identity). */
function hasKeylessItem(arr: unknown[], keyProps: string[]): boolean {
  for (const el of arr) {
    if (!isPlainObject(el)) return true;
    let hasAnyKey = false;
    for (const k of keyProps) {
      const v = el[k];
      if (v !== undefined && v !== null) {
        hasAnyKey = true;
        break;
      }
    }
    if (!hasAnyKey) return true;
  }
  return false;
}

/** Composite key string for a keyed-array element. */
function keyOf(el: Record<string, unknown>, keyProps: string[]): string {
  if (keyProps.length === 1) return stableKey(el[keyProps[0]!]);
  return keyProps.map((k) => stableKey(el[k])).join(" ");
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // NaN: `===` is false but a value reverted to a NaN baseline is unchanged.
  if (typeof a === "number" && typeof b === "number") return Number.isNaN(a) && Number.isNaN(b);
  if (a === null || b === null || a === undefined || b === undefined) return false;
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
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}
