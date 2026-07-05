import { computed, inject, type ComputedRef } from "vue";
import { getByPath, joinPath } from "@atscript/ui";
import { PATH_PREFIX_KEY, ROOT_DATA_KEY } from "./internal-keys";

export interface UseAsDataReturn {
  /** Domain data (the unwrapped inner value of the form's `{ value }` container). */
  rootData: ComputedRef<unknown>;
  /** Read the value at an absolute dotted path inside the form. */
  getValueAt: (path: string) => ComputedRef<unknown>;
  /** Read a sibling field's value relative to the current `useAsPath()` prefix. */
  siblingValue: <T = unknown>(name: string) => ComputedRef<T | undefined>;
}

const EMPTY_PATH = computed(() => "");
const EMPTY_DATA = computed<unknown>(() => undefined);

/**
 * Reactive read-only access to form data at any point in the
 * `<AsForm>` tree. Outside a form, all readers return `undefined`.
 *
 * Call sites get a `ComputedRef` so they can compose it directly with
 * other reactive primitives without an extra `computed()` wrapper.
 */
export function useAsData(): UseAsDataReturn {
  const wrapped = inject(ROOT_DATA_KEY, EMPTY_DATA);
  const pathPrefix = inject(PATH_PREFIX_KEY, EMPTY_PATH);

  // `wrapped.value` is the form-data container `{ value: domainData }`.
  // `getByPath` already understands the wrapper, but `rootData` exposes
  // the unwrapped domain value to keep call sites symmetric with
  // `siblingValue<T>()` returning `T`.
  const rootData = computed<unknown>(() => {
    const w = wrapped.value as { value?: unknown } | undefined;
    return w?.value;
  });

  function getValueAt(path: string): ComputedRef<unknown> {
    return computed(() => {
      const w = wrapped.value as Record<string, unknown> | undefined;
      if (!w) return undefined;
      return getByPath(w, path);
    });
  }

  function siblingValue<T = unknown>(name: string): ComputedRef<T | undefined> {
    return computed(() => {
      const w = wrapped.value as Record<string, unknown> | undefined;
      if (!w) return undefined;
      return getByPath(w, joinPath(pathPrefix.value, name)) as T | undefined;
    });
  }

  return { rootData, getValueAt, siblingValue };
}
