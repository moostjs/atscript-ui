import { computed } from "vue";
import type { ColumnDef } from "@atscript/ui";
import {
  formatColumnCondition,
  formatColumnValue,
  formatFilterCondition,
  type FilterCondition,
} from "@atscript/ui-table";
import type { ReactiveTableState } from "../types";
import { useCellLocale } from "./use-cell-locale";

/**
 * Chip wording for filter conditions, in the table's time zone and the cell
 * locale: "Last 7 days", "on Oct 5, 2026", "after Oct 5, 2026, 14:30" on date
 * columns, the operator symbols elsewhere. Reads reactive sources, so call the
 * returned functions inside `computed` / templates.
 *
 * Call in `setup` (it injects the cell locale).
 */
export function useConditionFormat(state: ReactiveTableState) {
  const { locale } = useCellLocale();
  const opts = () => ({ locale: locale.value, timeZone: state.timeZone.value });
  const columns = computed(() => new Map(state.allColumns.value.map((c) => [c.path, c])));

  return {
    /** One condition on `column` as a chip label. */
    formatCondition(column: ColumnDef | null | undefined, cond: FilterCondition): string {
      return column ? formatColumnCondition(column, cond, opts()) : formatFilterCondition(cond);
    },
    /** One value on the field at `path` — dates in words; `undefined` keeps the plain rendering. */
    formatValue(path: string, value: unknown): string | undefined {
      const column = columns.value.get(path);
      return column ? formatColumnValue(column, value, opts()) : undefined;
    },
    /** The display label of the field at `path`; `undefined` for an unknown one. */
    labelOf(path: string): string | undefined {
      return columns.value.get(path)?.label;
    },
  };
}
