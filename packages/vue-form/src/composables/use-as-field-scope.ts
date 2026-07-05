import {
  hasFieldMeta,
  resolveFieldProp,
  type FormFieldDef,
  type TResolveOptions,
} from "@atscript/ui";
import { buildFieldEntry, type TFnScope } from "@atscript/ui-fns";
import { useFormContext } from "./use-form-context";

/**
 * Shared inert scope for static-only resolution — no reactive reads.
 * Module-level singleton (also used by AsField's allStatic fast path).
 */
export const emptyScope: TFnScope = {
  v: undefined,
  data: {} as Record<string, unknown>,
  context: {} as Record<string, unknown>,
  entry: undefined,
};

/** Options for {@link UseAsFieldScopeReturn.resolveProp}. */
export interface TResolveFieldPropOptions<T> extends TResolveOptions<T> {
  /** Layer the field's evaluated `entry` into the fn scope (display-style fns). */
  withEntry?: boolean;
}

export interface UseAsFieldScopeReturn {
  /** Absolute dotted path of a child field (current prefix + `field.path`). */
  absolutePath: (field: FormFieldDef) => string;
  /**
   * Build the fn scope for a child field — `{ v, data, context }` with `v`
   * read at the field's absolute path. `withEntry` layers the evaluated
   * field `entry` on top (constraint fns take the bare scope; display fns
   * take the entry-carrying scope — mirrors AsField's dual-scope pattern).
   */
  scopeFor: (field: FormFieldDef, opts?: { withEntry?: boolean }) => TFnScope;
  /**
   * Resolve a `fnKey`/`staticKey` annotation pair on a child field,
   * presence-gated like AsField: neither key present → `undefined` without
   * touching reactive state; only the static key present → resolved against
   * the shared inert scope; fn key present → resolved against the full
   * reactive scope.
   */
  resolveProp: <T>(
    field: FormFieldDef,
    fnKey?: string,
    staticKey?: string,
    opts?: TResolveFieldPropOptions<T>,
  ) => T | undefined;
}

/**
 * Child-field scope building + annotation resolution for custom CONTAINER
 * renderers (tabbed shells, side-nav layouts) that partition or decorate a
 * structured field's children without mounting `<AsField>` for each one.
 *
 * Returns plain functions — no internal computeds. Wrap calls in your own
 * `computed` to inherit reactivity over form data.
 */
export function useAsFieldScope(): UseAsFieldScopeReturn {
  const { buildPath, getByPath, buildScope } = useFormContext("useAsFieldScope");

  function absolutePath(field: FormFieldDef): string {
    return buildPath(field.path);
  }

  function scopeFor(field: FormFieldDef, opts?: { withEntry?: boolean }): TFnScope {
    const base = buildScope(getByPath(buildPath(field.path)));
    if (!opts?.withEntry) return base;
    return buildFieldEntry(field.prop, base, field.path, {
      type: field.type,
      name: field.name,
    });
  }

  function resolveProp<T>(
    field: FormFieldDef,
    fnKey?: string,
    staticKey?: string,
    opts?: TResolveFieldPropOptions<T>,
  ): T | undefined {
    const hasFn = fnKey !== undefined && hasFieldMeta(field.prop, fnKey);
    if (!hasFn && (staticKey === undefined || !hasFieldMeta(field.prop, staticKey))) {
      return undefined;
    }
    const scope = hasFn ? scopeFor(field, { withEntry: opts?.withEntry }) : emptyScope;
    return resolveFieldProp<T>(
      field.prop,
      fnKey ?? "",
      staticKey,
      scope as unknown as Record<string, unknown>,
      opts,
    );
  }

  return { absolutePath, scopeFor, resolveProp };
}
