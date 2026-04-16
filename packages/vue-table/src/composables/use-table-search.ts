import { onBeforeUnmount } from "vue";
import { debounce } from "@atscript/ui-table";
import { useTableContext } from "./use-table-state";

/**
 * Convenience composable for wiring a search input to the table.
 * Must be called inside an `<AsTableRoot>` subtree.
 *
 * Returns the reactive `searchTerm` ref and an `onSearchInput` handler
 * that debounces query execution.
 */
export function useTableSearch(delay = 300) {
  const { state } = useTableContext();
  const debouncedQuery = debounce(() => state.query(), delay);

  onBeforeUnmount(() => debouncedQuery.cancel());

  function onSearchInput(event: Event) {
    state.searchTerm.value = (event.target as HTMLInputElement).value;
    debouncedQuery();
  }

  return { searchTerm: state.searchTerm, onSearchInput };
}
