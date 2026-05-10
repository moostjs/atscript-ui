import { computed, inject, type Component, type ComputedRef } from "vue";
import { TYPES_KEY } from "./internal-keys";

export interface UseAsTypeMapReturn {
  types: ComputedRef<Record<string, Component>>;
}

const EMPTY_TYPES: ComputedRef<Record<string, Component>> = computed(() => ({}));

/**
 * Reactive read-only access to the type-to-component map provided by the
 * nearest `<AsForm>`. Returns an empty map when called outside a form so
 * call sites do not need a null-check.
 */
export function useAsTypeMap(): UseAsTypeMapReturn {
  return { types: inject(TYPES_KEY, EMPTY_TYPES) };
}
