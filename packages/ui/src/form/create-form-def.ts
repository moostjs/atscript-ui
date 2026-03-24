import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeArray,
  TAtscriptTypeComplex,
  TAtscriptTypeObject,
} from "@atscript/typescript/utils";
import { flattenAnnotatedType } from "@atscript/typescript/utils";
import type {
  FormArrayFieldDef,
  FormDef,
  FormFieldDef,
  FormObjectFieldDef,
  FormTupleFieldDef,
  FormUnionFieldDef,
  FormUnionVariant,
} from "./types";
import { getFieldMeta, hasComputedAnnotations } from "../shared/field-resolver";
import { META_LABEL, UI_COMPONENT, UI_ORDER, UI_TYPE } from "../shared/annotation-keys";
import { isPureLiteralUnion } from "../value-help/extract-literals";

/** Known atscript primitive extension tags that map directly to field types. */
const UI_TAGS = new Set(["action", "paragraph", "select", "radio", "checkbox"]);

/**
 * Converts an ATScript annotated type into a FormDef.
 *
 * - **Object types** (`kind === 'object'`): produces an object root with nested fields.
 * - **Non-object types** (primitive, array, union, etc.): produces a single leaf root field
 *   with `path: ''`.
 */
export function createFormDef(type: TAtscriptAnnotatedType): FormDef {
  // Non-object types: single leaf field
  if (type.type.kind !== "object") {
    const rootField = createFieldDef("", type);
    return { type, rootField, fields: [rootField], flatMap: new Map() };
  }

  // Object types: flatten and iterate props
  const objectType = type as TAtscriptAnnotatedType<TAtscriptTypeObject>;
  const flatMap = flattenAnnotatedType(objectType, { excludePhantomTypes: false });

  const fields: FormFieldDef[] = [];
  const structuredPrefixes = new Set<string>();

  for (const [path, prop] of flatMap.entries()) {
    if (path === "") continue;
    if (isChildOfStructured(path, structuredPrefixes)) continue;

    const originalProp = resolveOriginalProp(objectType, path) ?? prop;
    const kind = originalProp.type.kind;

    // Flat objects (no label/component): skip, children render inline
    if (kind === "object") {
      const hasLabel = getFieldMeta(originalProp, META_LABEL) !== undefined;
      const hasComponent = getFieldMeta(originalProp, UI_COMPONENT) !== undefined;
      if (!hasLabel && !hasComponent) continue;
    }

    // Nested arrays without component: unsupported
    if (kind === "array") {
      const arrayType = originalProp.type as TAtscriptTypeArray;
      if (arrayType.of.type.kind === "array" && !getFieldMeta(originalProp, UI_COMPONENT)) continue;
    }

    // Mark structured prefixes (pre-suffixed with "." for efficient child checks)
    if (kind === "array" || kind === "object" || kind === "union" || kind === "tuple") {
      structuredPrefixes.add(path + ".");
    }

    fields.push(createFieldDef(path, originalProp));
  }

  // Sort by ui.order (cache order values to avoid repeated metadata lookups during sort)
  const orderMap = new Map(
    fields.map((f) => [f, (getFieldMeta(f.prop, UI_ORDER) as number | undefined) ?? Infinity]),
  );
  fields.sort((a, b) => orderMap.get(a)! - orderMap.get(b)!);

  const rootField = {
    path: "",
    prop: type,
    type: "object",
    phantom: false,
    name: "",
    allStatic: false,
  } as FormObjectFieldDef;
  const def: FormDef = { type, rootField, fields, flatMap };
  rootField.objectDef = def;
  return def;
}

// ── Unified field def creation ───────────────────────────────

/** Creates a FormFieldDef from any ATScript annotated type. */
function createFieldDef(path: string, prop: TAtscriptAnnotatedType): FormFieldDef {
  const kind = prop.type.kind;
  const name = path.slice(path.lastIndexOf(".") + 1);
  const allStatic = !hasComputedAnnotations(prop);
  const uiType = getFieldMeta(prop, UI_TYPE) as string | undefined;
  const base = { path, prop, phantom: false, name, allStatic };

  // Array
  if (kind === "array") {
    const arrayType = prop.type as TAtscriptTypeArray;
    return {
      ...base,
      type: "array",
      itemType: arrayType.of,
      itemField: createFieldDef("", arrayType.of),
    } as FormArrayFieldDef;
  }

  // Object
  if (kind === "object") {
    return {
      ...base,
      type: "object",
      objectDef: createFormDef(prop as TAtscriptAnnotatedType<TAtscriptTypeObject>),
    } as FormObjectFieldDef;
  }

  // Union → select (pure literals) or union (multi) or unwrap (single)
  if (kind === "union") {
    // Pure literal union → select (or @ui.type override like 'radio')
    if (isPureLiteralUnion(prop)) {
      return { ...base, type: uiType ?? "select" };
    }

    const unionVariants = buildUnionVariants(prop);
    if (unionVariants.length > 1) {
      return { ...base, type: "union", unionVariants } as FormUnionFieldDef;
    }
    const v = unionVariants[0];
    if (v?.itemField) return { ...v.itemField, path, name, allStatic };
    if (v?.def) {
      return { ...base, type: "object", objectDef: v.def } as FormObjectFieldDef;
    }
  }

  // Tuple → fixed-length array with typed positions
  if (kind === "tuple") {
    const tupleType = prop.type as TAtscriptTypeComplex;
    return {
      ...base,
      type: "tuple",
      itemFields: tupleType.items.map((item, i) => {
        const field = createFieldDef(String(i), item);
        field.name = "";
        return field;
      }),
    } as FormTupleFieldDef;
  }

  // Primitive / intersection / fallback
  const tags = kind === "" ? prop.type.tags : undefined;
  let uiTag: string | undefined;
  if (tags) {
    for (const t of tags) {
      if (UI_TAGS.has(t)) {
        uiTag = t;
        break;
      }
    }
  }
  const dt = kind === "" ? prop.type.designType : undefined;
  return {
    ...base,
    type: uiType ?? uiTag ?? (dt === "number" ? "number" : dt === "boolean" ? "checkbox" : "text"),
    phantom: kind === "" && dt === "phantom",
  };
}

// ── Helpers ─────────────────────────────────────────────────

/** Resolves the original annotated type from the type hierarchy by path. */
function resolveOriginalProp(
  type: TAtscriptAnnotatedType<TAtscriptTypeObject>,
  path: string,
): TAtscriptAnnotatedType | undefined {
  const parts = path.split(".");
  let current: TAtscriptTypeObject = type.type;
  for (let i = 0; i < parts.length - 1; i++) {
    const prop = current.props.get(parts[i]!);
    if (!prop || prop.type.kind !== "object") return undefined;
    current = prop.type as TAtscriptTypeObject;
  }
  return current.props.get(parts[parts.length - 1]!);
}

/** Check if a path is a child of any structured prefix (prefixes are pre-suffixed with "."). */
function isChildOfStructured(path: string, prefixes: Set<string>): boolean {
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Builds union variant definitions from a union annotated type.
 * Iterates top-level items directly — one variant per item.
 */
export function buildUnionVariants(typeDef: TAtscriptAnnotatedType): FormUnionVariant[] {
  const complex = typeDef.type as TAtscriptTypeComplex;
  const items = complex.items ?? [typeDef];
  const variants: FormUnionVariant[] = [];

  for (const item of items) {
    const v = createVariant(item);
    if (items.length > 1) {
      v.label = `${String(variants.length + 1)}. ${v.label}`;
    }
    variants.push(v);
  }

  return variants;
}

/** Creates a single union variant from an annotated type item. */
function createVariant(def: TAtscriptAnnotatedType): FormUnionVariant {
  const kind = def.type.kind;

  if (kind === "object") {
    const label = (getFieldMeta(def, META_LABEL) as string | undefined) ?? "Object";
    const hasComponent = getFieldMeta(def, UI_COMPONENT) !== undefined;
    return {
      label,
      type: def,
      def: createFormDef(def as TAtscriptAnnotatedType<TAtscriptTypeObject>),
      itemField: hasComponent ? createFieldDef("", def) : undefined,
    };
  }

  // Primitive (final or phantom)
  if (kind === "") {
    const dt = def.type.designType as string;
    return {
      label: capitalize(dt === "phantom" ? "item" : dt),
      type: def,
      itemField: createFieldDef("", def),
      designType: dt,
    };
  }

  // Complex types (array, tuple, intersection) — delegate to createFieldDef
  return {
    label: capitalize(kind),
    type: def,
    itemField: createFieldDef("", def),
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
