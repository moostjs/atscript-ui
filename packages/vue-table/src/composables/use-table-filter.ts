import { ref, computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { FilterCondition } from "@atscript/ui-table";
import {
  conditionsForType,
  columnFilterType,
  isFilled,
  defaultCondition,
} from "@atscript/ui-table";
import type { ReactiveTableState } from "../types";

/**
 * Per-field filter state composable.
 *
 * Creates a working copy of filter conditions (cancel-safe dialog model).
 * Call `apply()` to commit, `reset()` to revert, `clear()` to remove.
 *
 * Accepts `state` directly rather than injecting — safe to call outside `setup`.
 */
export function useTableFilter(column: ColumnDef, state: ReactiveTableState) {
  const filterType = columnFilterType(column.type);
  const availableConditions = conditionsForType(filterType);

  const defCondition = defaultCondition(filterType);

  function cloneConditions(): FilterCondition[] {
    const existing = state.filters.value[column.path];
    if (existing && existing.length > 0) {
      return existing.map((c) => ({ type: c.type, value: [...c.value] }));
    }
    return [{ type: defCondition, value: [] }];
  }

  const conditions = ref<FilterCondition[]>(cloneConditions());

  const filledCount = computed(() => conditions.value.filter(isFilled).length);

  function addCondition() {
    conditions.value = [...conditions.value, { type: defCondition, value: [] }];
  }

  function removeCondition(index: number) {
    conditions.value = conditions.value.filter((_, i) => i !== index);
    if (conditions.value.length === 0) {
      conditions.value = [{ type: defCondition, value: [] }];
    }
  }

  function updateCondition(index: number, update: Partial<FilterCondition>) {
    conditions.value = conditions.value.map((c, i) => (i === index ? { ...c, ...update } : c));
  }

  function apply() {
    state.setFieldFilter(column.path, conditions.value);
  }

  function clear() {
    state.removeFieldFilter(column.path);
    conditions.value = [{ type: defCondition, value: [] }];
  }

  function reset() {
    conditions.value = cloneConditions();
  }

  return {
    filterType,
    availableConditions,
    defaultCondition: defCondition,
    conditions,
    filledCount,
    addCondition,
    removeCondition,
    updateCondition,
    apply,
    clear,
    reset,
  };
}
