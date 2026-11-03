import { computed, inject, type ComputedRef } from "vue";
import { getByPath, joinPath, setByPath } from "@atscript/ui";
import { CHANGE_HANDLER_KEY, PATH_PREFIX_KEY, ROOT_DATA_KEY } from "./internal-keys";

export interface UseAsDataReturn {
  /** Domain data (the unwrapped inner value of the form's `{ value }` container). */
  rootData: ComputedRef<unknown>;
  /** Read the value at an absolute dotted path inside the form. */
  getValueAt: (path: string) => ComputedRef<unknown>;
  /** Read a sibling field's value relative to the current `useAsPath()` prefix. */
  siblingValue: <T = unknown>(name: string) => ComputedRef<T | undefined>;
  /**
   * Write the value at an absolute dotted path inside the form (missing
   * containers are created: an array where the next segment is an index,
   * else an object; an empty form root too). The write is a committed edit:
   * change tracking sees it, the field at that path re-validates like one the
   * user changed, and `AsForm` emits `change` with type `"update"`. Outside a
   * form, a no-op.
   */
  setValueAt: (path: string, value: unknown) => void;
  /**
   * Write a sibling field's value, relative to the current `useAsPath()`
   * prefix — e.g. a custom picker filling the fields next to it. Same rules
   * as `setValueAt`.
   */
  setSibling: (name: string, value: unknown) => void;
}

const EMPTY_PATH = computed(() => "");
const EMPTY_DATA = computed<unknown>(() => undefined);

/**
 * Reactive access to form data at any point in the `<AsForm>` tree: readers
 * plus `setValueAt` / `setSibling` writers. Outside a form, all readers
 * return `undefined` and the writers do nothing.
 *
 * Call sites get a `ComputedRef` so they can compose it directly with
 * other reactive primitives without an extra `computed()` wrapper.
 */
export function useAsData(): UseAsDataReturn {
  const wrapped = inject(ROOT_DATA_KEY, EMPTY_DATA);
  const pathPrefix = inject(PATH_PREFIX_KEY, EMPTY_PATH);
  const handleChange = inject(CHANGE_HANDLER_KEY, undefined);

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

  function setValueAt(path: string, value: unknown): void {
    const w = wrapped.value as Record<string, unknown> | undefined;
    if (!w) return;
    setByPath(w, path, value);
    // Committed like a user edit: `AsForm` emits `change` ("update").
    handleChange?.("update", path, value);
  }

  function setSibling(name: string, value: unknown): void {
    setValueAt(joinPath(pathPrefix.value, name), value);
  }

  return { rootData, getValueAt, siblingValue, setValueAt, setSibling };
}
