import { computed, getCurrentInstance, type ComputedRef } from "vue";

/**
 * Returns true when the parent component bound a v-on listener for `emitName`
 * (e.g. `onMainAction` for `@main-action`). Reads `inst.vnode.props` — the
 * same property Vue uses to dispatch emit listeners. Non-reactive: a parent
 * remount via `v-if` re-evaluates at the new mount.
 */
export function useHasEmitListener(emitName: `on${Capitalize<string>}`): ComputedRef<boolean> {
  const inst = getCurrentInstance();
  return computed(() => !!inst?.vnode.props?.[emitName]);
}
