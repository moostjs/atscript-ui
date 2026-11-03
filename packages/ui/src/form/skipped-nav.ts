import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { isNavRelation } from "@atscript/db/validator";
import { UI_FORM_NS } from "../shared/annotation-keys";
import { deepClone } from "./clone";
import { detectUnionVariant, getByPath, isPlainObject } from "./path-utils";
import type { FormDef, FormFieldDef } from "./types";
import { childFields, isArrayField, isObjectField, isTupleField, isUnionField } from "./types";

// ── Navigation fields the form leaves out ────────────────────

/**
 * Whether a form leaves this prop out: a navigation field (`@db.rel.from` /
 * `.to` / `.via`) without a `@ui.form.*` annotation of its own. Navigation
 * fields hold related rows (loaded with `$with`), not data the row's own form
 * edits, and a two-way pair points back at the form's own type. Annotating one
 * (`@ui.form.order`, `@ui.form.component`, …) opts it in.
 */
export function isSkippedNavField(prop: TAtscriptAnnotatedType): boolean {
  if (!isNavRelation(prop)) return false;
  for (const key of prop.metadata.keys()) {
    if (key.startsWith(UI_FORM_NS)) return false;
  }
  return true;
}

/** Per def: the paths of its own skipped navigation fields. */
const ownSkippedNav = new WeakMap<FormDef, string[]>();

/** Per def: whether a skipped navigation field is reachable below its own props. */
const nestedSkippedNav = new WeakMap<FormDef, boolean>();

/**
 * The paths of `def`'s own props that are navigation fields the form leaves
 * out — none below another one, which goes with it. Cached per def.
 */
function ownSkippedNavPaths(def: FormDef): string[] {
  let paths = ownSkippedNav.get(def);
  if (!paths) {
    paths = [];
    for (const [path, prop] of def.flatMap) {
      if (!path || paths.some((p) => path.startsWith(`${p}.`))) continue;
      if (isSkippedNavField(prop)) paths.push(path);
    }
    ownSkippedNav.set(def, paths);
  }
  return paths;
}

/**
 * Whether a def nested in `def` (an object field, an array item, a union
 * variant, …) has a navigation field the form leaves out (see
 * `isSkippedNavField`) — data a whole-value patch entry could carry. Cached
 * per def; cycle-safe.
 */
export function hasNestedSkippedNavFields(def: FormDef): boolean {
  const known = nestedSkippedNav.get(def);
  if (known !== undefined) return known;
  const hasOwn = (d: FormDef | undefined) => d !== undefined && ownSkippedNavPaths(d).length > 0;
  const seen = new Set<FormFieldDef>();
  const reaches = (f: FormFieldDef): boolean => {
    if (seen.has(f)) return false;
    seen.add(f);
    if (isObjectField(f) && hasOwn(f.objectDef)) return true;
    if (isUnionField(f) && f.unionVariants.some((v) => hasOwn(v.def))) return true;
    return childFields(f).some(reaches);
  };
  // The root's own navigation fields don't count, unless reached again below.
  const result = def.fields.some(reaches);
  nestedSkippedNav.set(def, result);
  return result;
}

/**
 * A deep copy of form data `value` (the unwrapped domain data of `def`'s type)
 * without the navigation fields the form leaves out, at any depth: related
 * rows loaded with `$with` that the form neither renders nor validates are
 * never sent. Returns `value` itself when `def` reaches no such field.
 */
export function omitSkippedNavFields<T>(def: FormDef, value: T): T {
  if (!hasNestedSkippedNavFields(def) && ownSkippedNavPaths(def).length === 0) return value;
  const copy = deepClone(value);
  stripDef(def, copy);
  return copy;
}

function stripDef(def: FormDef, value: unknown): void {
  if (!isPlainObject(value)) return;
  const data = { value };
  for (const path of ownSkippedNavPaths(def)) {
    const dot = path.lastIndexOf(".");
    const parent = dot < 0 ? value : getByPath(data, path.slice(0, dot));
    if (isPlainObject(parent)) delete parent[path.slice(dot + 1)];
  }
  // Nothing to strip below: skip the walk (an array's rows included).
  if (!hasNestedSkippedNavFields(def)) return;
  for (const f of def.fields) {
    if (f.path) stripField(f, getByPath(data, f.path));
  }
}

function stripField(field: FormFieldDef, value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (isObjectField(field)) stripDef(field.objectDef, value);
  else if (isArrayField(field)) {
    if (Array.isArray(value)) for (const item of value) stripField(field.itemField, item);
  } else if (isTupleField(field)) {
    if (Array.isArray(value)) field.itemFields.forEach((f, i) => stripField(f, value[i]));
  } else if (isUnionField(field)) {
    const v = field.unionVariants[detectUnionVariant(value, field.unionVariants)];
    if (v?.def) stripDef(v.def, value);
    else if (v?.itemField) stripField(v.itemField, value);
  }
}
