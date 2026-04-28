import type { Component } from "vue";
import type { TAsTableControls } from "../types";
import { useTableContext } from "./use-table-state";

/** Resolve a single skin-slot component from the injected `controls` map, falling back to the default. */
export function useTableComponent<K extends keyof TAsTableControls>(
  key: K,
  fallback: Component,
): Component {
  const { controls } = useTableContext();
  return controls[key] ?? fallback;
}
