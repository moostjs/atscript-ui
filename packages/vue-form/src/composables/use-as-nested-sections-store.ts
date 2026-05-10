import { inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";

/**
 * Reactive open/closed registry for collapsible object sections rendered
 * by `AsObject`. Provided once per `<AsForm>` so the entire form shares a
 * single store; consumers (page chrome, devtools, dialogs) can `inject`
 * the store via `useAsNestedSectionsStore()` to drive Expand-all /
 * Collapse-all UI without prop drilling.
 *
 * **Default state is closed.** IDs only enter `open` when explicitly
 * expanded (user click, native `<details>` toggle, programmatic
 * `setOpen` / `expandAll`). The native `<details>` toggle event syncs
 * back via `setOpen(id, open)` (idempotent, so browser find-in-page
 * auto-opens don't fight the store).
 */
export interface AsNestedSectionsStore {
  open: Ref<Set<string>>;
  register: (id: string) => void;
  unregister: (id: string) => void;
  toggle: (id: string) => void;
  setOpen: (id: string, open: boolean) => void;
  isOpen: (id: string) => boolean;
  expandAll: () => void;
  collapseAll: () => void;
  allOpen: () => boolean;
}

const STORE_KEY: InjectionKey<AsNestedSectionsStore> = Symbol("atui.nested-sections");

/**
 * AsForm provides a `Map<absolutePath, descendantErrorCount>` so each
 * AsObject can render its error-count badge in O(1) instead of scanning
 * all errors per-instance. Keyed by every dotted-path prefix that has at
 * least one error at-or-below it.
 */
export const DESCENDANT_ERROR_COUNTS_KEY: InjectionKey<ComputedRef<Map<string, number>>> = Symbol(
  "atui.descendant-error-counts",
);

/**
 * Create and provide a `AsNestedSectionsStore` to the current Vue subtree.
 * Called automatically by `<AsForm>`, but exposed for cases where you
 * want to scope a separate store (e.g. multiple independent forms in one
 * page that should keep their open/closed state independent, or to drive
 * page-level Expand-all / Collapse-all UI from above the form).
 */
export function provideAsNestedSectionsStore(): AsNestedSectionsStore {
  // `ref(new Set())` proxies the Set so `.add` / `.delete` / `.size` are
  // reactive — no need to reassign with a fresh Set on every mutation.
  const open = ref<Set<string>>(new Set());
  const registered = ref<Set<string>>(new Set());

  const store: AsNestedSectionsStore = {
    open,
    register(id) {
      registered.value.add(id);
    },
    unregister(id) {
      registered.value.delete(id);
    },
    toggle(id) {
      if (open.value.has(id)) open.value.delete(id);
      else open.value.add(id);
    },
    setOpen(id, isOpen) {
      if (isOpen) {
        if (!open.value.has(id)) open.value.add(id);
      } else if (open.value.has(id)) {
        open.value.delete(id);
      }
    },
    isOpen(id) {
      return open.value.has(id);
    },
    expandAll() {
      for (const id of registered.value) open.value.add(id);
    },
    collapseAll() {
      open.value.clear();
    },
    allOpen() {
      return open.value.size === registered.value.size;
    },
  };

  provide(STORE_KEY, store);
  return store;
}

/**
 * Inject the nested-sections store provided by an ancestor `<AsForm>`
 * (or by an explicit `provideAsNestedSectionsStore()` call). Returns
 * `undefined` if no store is in scope.
 */
export function useAsNestedSectionsStore(): AsNestedSectionsStore | undefined {
  return inject(STORE_KEY, undefined);
}
