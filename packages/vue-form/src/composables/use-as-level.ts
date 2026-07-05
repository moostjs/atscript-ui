import { computed, inject, provide, type ComputedRef } from "vue";
import { LEVEL_KEY } from "./internal-keys";

const ROOT_LEVEL: ComputedRef<number> = computed(() => -1);

/**
 * Reactive read-only access to the structured-field nesting level at the
 * current point in the `<AsForm>` tree. `-1` outside any structured field;
 * the root structured field renders at `0`, its structured children at `1`,
 * and so on. Drives the section/island alternation (`AsCollapsible`:
 * L1/L3/L5 → section, L2/L4/L6 → island).
 */
export function useAsLevel(): ComputedRef<number> {
  return inject(LEVEL_KEY, ROOT_LEVEL);
}

/**
 * Bump the structured-field nesting level for the current Vue subtree,
 * RELATIVE to the injected parent level.
 *
 * For custom CONTAINER renderers (tabbed shells, side-nav layouts) that
 * replace a structured field's collapsible chrome and mount its children
 * directly (e.g. via `<AsIterator :def="field.objectDef">`): without this,
 * the children read the level of the custom renderer's own host field, land
 * one level shallower than the stock rendering, and break the section/island
 * alternation (see {@link useAsLevel}).
 *
 * Call it in the component that wraps the replaced section's BODY with the
 * number of level slots the custom chrome stands in for — usually the
 * default `1` (the section itself). Because the bump is relative, the same
 * renderer stays correct at any depth: nested structured fields resume the
 * stock alternation at `parent + levels + 1`.
 */
export function provideAsNestedLevel(levels = 1): void {
  const parent = inject(LEVEL_KEY, ROOT_LEVEL);
  provide(
    LEVEL_KEY,
    computed(() => parent.value + levels),
  );
}
