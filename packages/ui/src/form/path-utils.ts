import type {
  TAtscriptAnnotatedType,
  TAtscriptDataType,
  TUnionDiscriminator,
} from "@atscript/typescript/utils";
import { createDataFromAnnotatedType, detectDiscriminator } from "@atscript/typescript/utils";
import type { FormUnionVariant } from "./types";
import { META_DEFAULT, UI_FORM_FN_VALUE } from "../shared/annotation-keys";
import { resolveFieldProp } from "../shared/field-resolver";

// ── Path utilities ──────────────────────────────────────────

/**
 * Gets a nested value by dot-separated path.
 * Always dereferences `obj.value` first (form data is wrapped in `{ value: domainData }`).
 * When `path` is empty, returns the root domain data (`obj.value`).
 */
export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const root = obj.value;
  if (!path) return root;
  const keys = path.split(".");
  let current: unknown = root;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Sets a nested value by dot-separated path.
 * Always dereferences `obj.value` first (form data is wrapped in `{ value: domainData }`).
 * When `path` is empty, sets the root domain data (`obj.value = value`).
 * Creates intermediate objects if they do not exist.
 */
export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  if (!path) {
    obj.value = value;
    return;
  }
  const keys = path.split(".");
  const last = keys.pop();
  if (last === undefined) return;
  let current: Record<string, unknown> = obj.value as Record<string, unknown>;
  for (const key of keys) {
    if (current[key] === null || current[key] === undefined || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[last] = value;
}

// ── createFormData ──────────────────────────────────────────

function parseStaticDefault(raw: unknown, prop: TAtscriptAnnotatedType): unknown {
  if (typeof raw !== "string") return raw;
  if (prop.type.kind === "" && prop.type.designType === "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Value resolver function type — created once per form, reused across calls. */
export type TFormValueResolver = (prop: TAtscriptAnnotatedType, path: string) => unknown;

/** Cached default resolver — reused when no resolver is provided. */
const defaultValueResolver: TFormValueResolver = createFormValueResolver();

export function createFormValueResolver(
  data: Record<string, unknown> = {},
  context: Record<string, unknown> = {},
): TFormValueResolver {
  return (prop, _path) => {
    return resolveFieldProp(
      prop,
      UI_FORM_FN_VALUE,
      META_DEFAULT,
      { v: undefined, data, context, entry: undefined },
      { transform: (raw) => parseStaticDefault(raw, prop) },
    );
  };
}

/**
 * Type-appropriate "defined-but-empty" fallback for primitive design types
 * whose structural default in atscript's `finalDefault` table is
 * `undefined`. Without this, `createFormData` on an optional `decimal`
 * field (or any other primitive missed by atscript's table) returns
 * `undefined` — but `createFormData` is called from "explicit add"
 * contexts (optional-toggle, array-add, tuple-pad, union-pick) where the
 * caller's intent is "give me a value the renderer can edit", not "no
 * value yet". Returning `undefined` leaves the empty-state placeholder
 * stuck in AsFieldShell.
 *
 * `decimal → "0"` mirrors the `number → 0` default — the atscript runtime
 * validator (≥ 0.1.54) rejects `""` for decimal fields, so committing the
 * canonical zero is the only init that survives a submit-without-edit.
 * `useAsDecimal` pads the display to the field's effective scale, so the
 * user sees `0.00` / `0.000` per the `@db.column.precision` annotation.
 */
function primitiveInitFallback(prop: TAtscriptAnnotatedType): unknown {
  if (prop.type.kind !== "") return undefined;
  switch (prop.type.designType) {
    case "decimal":
      return "0";
    default:
      return undefined;
  }
}

export function createFormData<T extends TAtscriptAnnotatedType>(
  type: T,
  resolver?: TFormValueResolver,
): { value: TAtscriptDataType<T> } {
  let value = createDataFromAnnotatedType(type, {
    mode: resolver ?? defaultValueResolver,
  });
  // Backfill primitive design types that atscript's `finalDefault` leaves
  // as `undefined` (notably `decimal`). Form-level callers explicitly want
  // a defined-but-empty value — `createFormData` is the "make this exist"
  // boundary, not the "fill if available" one (that's still the resolver).
  if (value === undefined) {
    value = primitiveInitFallback(type);
  }
  return {
    value: value as TAtscriptDataType<T>,
  };
}

// ── Union variant detection ─────────────────────────────────

// Lazily-cached validators keyed by variant type identity.
const variantValidatorCache = new WeakMap<
  TAtscriptAnnotatedType,
  ReturnType<TAtscriptAnnotatedType["validator"]>
>();

function getVariantValidator(variant: FormUnionVariant) {
  let v = variantValidatorCache.get(variant.type);
  if (!v) {
    v = variant.type.validator();
    variantValidatorCache.set(variant.type, v);
  }
  return v;
}

// Keyed by the array identity that `buildUnionVariants` produces — stable for
// the form-def's lifetime, so per-array caching is safe.
const variantsDiscriminatorCache = new WeakMap<FormUnionVariant[], TUnionDiscriminator | null>();

function getVariantsDiscriminator(variants: FormUnionVariant[]): TUnionDiscriminator | null {
  let cached = variantsDiscriminatorCache.get(variants);
  if (cached === undefined) {
    cached = detectDiscriminator(variants.map((v) => v.type));
    variantsDiscriminatorCache.set(variants, cached);
  }
  return cached;
}

export function detectUnionVariant(value: unknown, variants: FormUnionVariant[]): number {
  if (variants.length <= 1) return 0;

  const disc = getVariantsDiscriminator(variants);
  if (disc && value !== null && typeof value === "object") {
    const tag = (value as Record<string, unknown>)[disc.propertyName];
    // `String(undefined) === 'undefined'` and won't match any literal key —
    // safe to forward without a guard; fall through to validator on miss.
    const idx = disc.indexMapping[String(tag)];
    if (idx !== undefined) return idx;
  }

  for (let i = 0; i < variants.length; i++) {
    try {
      if (getVariantValidator(variants[i]!).validate(value, true)) return i;
    } catch {}
  }

  return 0;
}
