import { computed, inject, type ComputedRef } from "vue";
import { PATH_PREFIX_KEY } from "./internal-keys";

export interface UseAsPathReturn {
  path: ComputedRef<string>;
}

const EMPTY_PATH: ComputedRef<string> = computed(() => "");

/**
 * Reactive read-only access to the absolute dotted path prefix at the
 * current point in the `<AsForm>` tree. Returns `''` when called outside
 * a form.
 */
export function useAsPath(): UseAsPathReturn {
  return { path: inject(PATH_PREFIX_KEY, EMPTY_PATH) };
}
