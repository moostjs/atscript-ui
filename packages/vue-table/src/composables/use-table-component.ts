import { inject, type Component } from "vue";
import type { TAsTableComponents } from "../types";
import { TABLE_COMPONENTS_KEY } from "./use-table-state";

/** Resolve a single component from the injected types map, falling back to the default. */
export function useTableComponent<K extends keyof TAsTableComponents>(
  key: K,
  fallback: Component,
): Component {
  const components = inject<TAsTableComponents>(TABLE_COMPONENTS_KEY, {});
  return components[key] ?? fallback;
}
