import { onMounted, toValue, watch, type MaybeRefOrGetter } from "vue";

/**
 * Run `seed` whenever a dialog's open source becomes (or changes while)
 * truthy, AND once on mount when it is already truthy.
 *
 * The mount-time run exists because `<AsTableRoot>` lazy-mounts its default
 * dialogs: the component is created only after the open state is already
 * true, so the false→true transition happens before any watcher exists and
 * the draft must snapshot current state on setup too. Using `onMounted`
 * instead of `{ immediate: true }` keeps the initial run out of setup, so
 * `seed` may safely reference refs/functions declared after the call site
 * (no temporal-dead-zone hazard).
 *
 * `isOpen` may be a boolean, or any value whose truthiness means "open"
 * (e.g. the column a filter dialog edits) — re-seeding also fires when that
 * value changes from one truthy value to another.
 *
 * Internal (Tier 3) — not exported from the package entry.
 */
export function useSeedOnOpen(isOpen: MaybeRefOrGetter<unknown>, seed: () => void): void {
  watch(
    () => toValue(isOpen),
    (open) => {
      if (open) seed();
    },
  );
  onMounted(() => {
    if (toValue(isOpen)) seed();
  });
}
