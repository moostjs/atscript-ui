import { inject } from "vue";
import { DISMISS_EXTERNAL_AT_KEY } from "./internal-keys";

/**
 * Imperative dismissal of an external (server-supplied) error at a given
 * absolute path. Calling this is equivalent to the user editing that
 * field — useful for custom field components that commit a value through
 * a side-channel (e.g. a date picker dialog) and want to hide the
 * server's error before the next round-trip.
 */
export type AsErrorDismiss = (path: string) => void;

const NOOP: AsErrorDismiss = () => {};

/**
 * Returns the `dismissExternalAt` callback provided by the nearest
 * ancestor `<AsForm>`. Outside a form the result is a no-op so calling
 * it from a leaf component does not throw.
 */
export function useAsErrorDismiss(): AsErrorDismiss {
  const dismiss = inject(DISMISS_EXTERNAL_AT_KEY, null);
  return dismiss ?? NOOP;
}
