import { computed, provide } from "vue";
import { LEVEL_KEY } from "./internal-keys";

/**
 * Provide the structured-field nesting level to the current Vue subtree.
 *
 * For custom SECTION renderers (tabbed shells, side-nav layouts) that replace a
 * structured field's collapsible chrome and mount its children directly (e.g.
 * via `<AsIterator :def="field.objectDef">`): without this, the children read
 * the level of the custom renderer's own host field, land one level shallower
 * than the stock rendering, and break the section/island alternation
 * (`AsCollapsible`: L1/L3/L5 → section, L2/L4/L6 → island).
 *
 * Call it in the component that wraps the replaced section's BODY with the
 * level the section itself occupies (e.g. `provideAsNestedLevel(1)` when the
 * custom chrome stands in for a level-1 section) — nested structured fields
 * then resume the stock alternation at `level + 1`.
 */
export function provideAsNestedLevel(level: number): void {
  provide(
    LEVEL_KEY,
    computed(() => level),
  );
}
