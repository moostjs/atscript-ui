import { useTableContext } from "./use-table-state";

/**
 * Convenience composable for wiring a search input to the table.
 * Must be called inside an `<AsTableRoot>` subtree.
 *
 * Returns the reactive `searchTerm` ref and an `onSearchInput` handler.
 * The central filter/search watcher debounces the auto-query.
 */
export function useTableSearch() {
  const { state } = useTableContext();

  function onSearchInput(event: Event) {
    state.searchTerm.value = (event.target as HTMLInputElement).value;
  }

  return { searchTerm: state.searchTerm, onSearchInput };
}
