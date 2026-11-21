import { inject, onBeforeUnmount, provide, ref, type InjectionKey, type Ref } from "vue";

/**
 * Holding an editor in place while the user is in it. An emptied input of an
 * optional field commits `undefined`, and the chrome around it swaps an unset
 * field for its placeholder (AsFieldShell's "Not set", AsUnion's "Add") — so
 * while focus is in the input the editor must stay, and the placeholder shows
 * once focus leaves.
 *
 * Internal — not exported from the package barrel. The key is private to this
 * module.
 */
const EDITING_HOLD_KEY: InjectionKey<Ref<boolean> | undefined> = Symbol("atui.editing-hold");

/**
 * For a container that swaps its editor for a placeholder (AsUnion): whether
 * an input row below it has focus, fed by the {@link useEditingHold} rows.
 */
export function provideEditingHold(): Ref<boolean> {
  const editing = ref(false);
  provide(EDITING_HOLD_KEY, editing);
  return editing;
}

export interface EditingHold {
  /** Focus is in the element the handlers are bound on. */
  editing: Ref<boolean>;
  onFocusin: () => void;
  onFocusout: (e: FocusEvent) => void;
}

/**
 * Focus tracking for an input row (bind `onFocusin` / `onFocusout` on it),
 * mirrored into the closest {@link provideEditingHold}. Consumed: a row inside
 * another row's subtree does not report to the container.
 *
 * Focus moving between two elements of the row keeps `editing`, and so does
 * the window losing focus: the browser then fires `focusout` with no
 * `relatedTarget`, but the input stays the document's active element (on a
 * move to another element of the page it is `<body>` during `focusout`).
 */
export function useEditingHold(): EditingHold {
  const container = inject(EDITING_HOLD_KEY, undefined);
  provide(EDITING_HOLD_KEY, undefined);
  const editing = ref(false);

  function set(value: boolean): void {
    editing.value = value;
    if (container) container.value = value;
  }

  onBeforeUnmount(() => {
    if (editing.value && container) container.value = false;
  });

  return {
    editing,
    onFocusin: () => set(true),
    onFocusout: (e) => {
      const row = e.currentTarget as HTMLElement;
      set(row.contains(e.relatedTarget as Node | null) || row.contains(document.activeElement));
    },
  };
}
