import type { TAtscriptAnnotatedType, TAtscriptDataType } from "@atscript/typescript/utils";
import { createDataFromAnnotatedType } from "@atscript/typescript/utils";
import type { FormUnionVariant } from "./types";
import { META_DEFAULT } from "../shared/annotation-keys";

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

/**
 * Coerces a static annotation string to the field's expected type.
 * Strings are returned as-is for string fields; everything else goes through `JSON.parse`.
 */
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

/**
 * Creates a reusable value resolver for form data creation.
 * Cascade: `meta.default` → structural default.
 *
 * For dynamic values (`ui.fn.value`), use ui-fns which extends this cascade.
 */
export function createFormValueResolver(): TFormValueResolver {
  return (prop, _path) => {
    // meta.default — ATScript standard
    const metaDefault = prop.metadata.get(META_DEFAULT as keyof AtscriptMetadata);
    if (metaDefault !== undefined) {
      return parseStaticDefault(metaDefault, prop);
    }
    // Fall through → createDataFromAnnotatedType applies structural default
    return undefined;
  };
}

/**
 * Creates form data from an ATScript type with default values.
 *
 * Uses `createDataFromAnnotatedType` with a custom resolver that checks
 * `meta.default` before falling through to structural defaults.
 * Phantom types (action, paragraph) are skipped automatically.
 */
export function createFormData<T extends TAtscriptAnnotatedType>(
  type: T,
  resolver?: TFormValueResolver,
): { value: TAtscriptDataType<T> } {
  return {
    value: createDataFromAnnotatedType(type, {
      mode: resolver ?? defaultValueResolver,
    }) as TAtscriptDataType<T>,
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

/**
 * Detects which union variant an existing value matches.
 *
 * @returns Index of the matching variant (0-based), or 0 as fallback
 */
export function detectUnionVariant(value: unknown, variants: FormUnionVariant[]): number {
  if (variants.length <= 1) return 0;

  for (let i = 0; i < variants.length; i++) {
    try {
      if (getVariantValidator(variants[i]!).validate(value, true)) return i;
    } catch {
      // Validator threw — skip this variant
    }
  }

  return 0;
}
