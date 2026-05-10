import { computed, ref, watch, type ComputedRef } from "vue";

/**
 * Source of externally-supplied (server) errors. Reading this getter
 * inside a Vue reactive scope subscribes the composable to identity
 * changes — when the source returns a *different* object reference
 * (typically a fresh server response), all locally-applied dismissals
 * reset automatically.
 */
export interface UseAsExternalErrorsOptions {
  source: () => Record<string, string | undefined> | undefined;
}

export interface UseAsExternalErrorsReturn {
  /**
   * Errors map after leaf-path dismissals applied. The `__form` key is
   * always omitted — render form-level errors via `formError`. Returns
   * `undefined` when the source itself is `undefined` (no errors at all),
   * so consumers can preserve the original "errors prop unset" semantics.
   */
  effective: ComputedRef<Record<string, string | undefined> | undefined>;
  /** Top-level `__form` error (post banner-dismissal). `undefined` while dismissed or absent. */
  formError: ComputedRef<string | undefined>;
  /** Whether the form-level banner is currently dismissed. */
  isFormDismissed: ComputedRef<boolean>;
  /** Mark a leaf-field path as dismissed locally. Idempotent. */
  dismissAt: (path: string) => void;
  /** Dismiss the form-level banner. */
  dismissForm: () => void;
  /** Reset all dismissals (rarely needed; identity-change does this for you). */
  reset: () => void;
}

/**
 * Local dismissal state for externally-supplied errors.
 *
 * - `dismissAt(path)` hides a leaf error until either the user un-dismisses
 *   it or a *fresh* errors object arrives (new identity).
 * - `dismissForm()` hides the `__form` banner. Same identity-reset rule, but
 *   never cleared by leaf calls.
 * - In-place mutation of the source object does NOT reset dismissals; only
 *   identity changes do. A fresh response (`errors.value = { ... }`) re-arms
 *   everything, while in-place tweaks (rare) deliberately preserve them.
 *
 * The composable is pure — it does NOT call `provide()`. The owning form
 * composable wires `dismissAt` into the form's inject contract.
 */
export function useAsExternalErrors(
  options: UseAsExternalErrorsOptions,
): UseAsExternalErrorsReturn {
  const dismissedPaths = ref<Set<string>>(new Set());
  const formDismissed = ref(false);

  function reset() {
    if (dismissedPaths.value.size > 0) dismissedPaths.value = new Set();
    if (formDismissed.value) formDismissed.value = false;
  }

  // Identity watcher: a new errors-map reference re-arms all dismissals so
  // the next server round-trip surfaces every error again, even if the user
  // had previously dismissed some of them.
  watch(() => options.source(), reset);

  const effective = computed<Record<string, string | undefined> | undefined>(() => {
    const errs = options.source();
    if (!errs) return undefined;
    const dismissed = dismissedPaths.value;
    // Fast path: no dismissals AND no `__form` to strip — return the
    // source as-is so identity-equal consumers don't re-render.
    if (dismissed.size === 0 && errs.__form === undefined) return errs;
    const out: Record<string, string | undefined> = {};
    for (const k in errs) {
      if (k === "__form") continue;
      if (dismissed.has(k)) continue;
      out[k] = errs[k];
    }
    return out;
  });

  const formError = computed<string | undefined>(() => {
    if (formDismissed.value) return undefined;
    return options.source()?.__form;
  });

  const isFormDismissed = computed(() => formDismissed.value);

  function dismissAt(path: string) {
    if (!path) return;
    if (dismissedPaths.value.has(path)) return;
    const next = new Set(dismissedPaths.value);
    next.add(path);
    dismissedPaths.value = next;
  }

  function dismissForm() {
    if (!formDismissed.value) formDismissed.value = true;
  }

  return { effective, formError, isFormDismissed, dismissAt, dismissForm, reset };
}
