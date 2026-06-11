import type { Component } from "vue";
import type { TAsTableControls } from "../types";
import { useTableContextOptional } from "./use-table-state";

/**
 * Resolve a single skin-slot component from the injected `controls` map,
 * falling back to the default. Safe to call outside a table context (e.g.
 * a default mounted standalone in tests) — the fallback is returned.
 */
export function useTableComponent<K extends keyof TAsTableControls>(
  key: K,
  fallback: Component,
): Component {
  const ctx = useTableContextOptional();
  return ctx?.controls[key] ?? fallback;
}
