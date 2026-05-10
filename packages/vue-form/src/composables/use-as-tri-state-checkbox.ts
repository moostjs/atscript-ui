import { computed, ref, watchEffect, type ComputedRef, type Ref } from "vue";

/**
 * Options for `useAsTriStateCheckbox`.
 *
 * Consolidates the "checked / unchecked / indeterminate" mechanics for
 * boolean fields whose model can be `undefined` (optional booleans, or
 * checkboxes that round-trip from a SQL NULL). HTML5's `indeterminate`
 * is a property on the DOM element — not a reflectable attribute — so
 * the composable wires it via a `watchEffect`.
 */
export interface UseAsTriStateCheckboxOptions {
  /**
   * Reactive getter for the current model value. `undefined` renders the
   * indeterminate look; `true` / `false` render checked / unchecked.
   */
  modelValue: () => boolean | undefined;
  /**
   * Called when the user toggles the checkbox. Receives the new value as
   * read off the input's `checked` property after the click.
   */
  onCommit: (value: boolean) => void;
}

export interface UseAsTriStateCheckboxReturn {
  /**
   * Bind to `<input type="checkbox" :checked>`. Equivalent to
   * `modelValue() === true`.
   */
  checked: ComputedRef<boolean>;
  /**
   * `true` when the model is `undefined` — render the indeterminate
   * look (the composable also wires the DOM property via `watchEffect`).
   */
  indeterminate: ComputedRef<boolean>;
  /**
   * Template ref for the `<input>` element. The composable observes it
   * and writes the `indeterminate` property whenever the model becomes
   * `undefined`.
   */
  inputRef: Ref<HTMLInputElement | null>;
  /** Bind to `@change`. Reads `e.target.checked` and forwards to `onCommit`. */
  onChange: (e: Event) => void;
}

/**
 * Tri-state checkbox helper. The visible state is derived from the
 * model: `true` checked, `false` unchecked, `undefined` indeterminate.
 * Clicking commits a boolean — never `undefined` — because browsers do
 * not emit a "tri-state click". The "back to undefined" path stays a
 * separate optional-clear affordance owned by the host component.
 *
 * Use this composable in a custom checkbox swap component to inherit the
 * same a11y / DOM-sync behaviour as the built-in `AsCheckbox` without
 * re-implementing the `watchEffect` plumbing or remembering that
 * `indeterminate` is a property, not an attribute.
 */
export function useAsTriStateCheckbox(
  options: UseAsTriStateCheckboxOptions,
): UseAsTriStateCheckboxReturn {
  const inputRef = ref<HTMLInputElement | null>(null);

  const checked = computed(() => options.modelValue() === true);
  const indeterminate = computed(() => options.modelValue() === undefined);

  // HTML5 `indeterminate` is a property, not an attribute — sync via the
  // ref. `flush: 'post'` so the input element is mounted before we touch it.
  watchEffect(
    () => {
      if (inputRef.value) inputRef.value.indeterminate = indeterminate.value;
    },
    { flush: "post" },
  );

  function onChange(e: Event): void {
    options.onCommit((e.target as HTMLInputElement).checked);
  }

  return { checked, indeterminate, inputRef, onChange };
}
