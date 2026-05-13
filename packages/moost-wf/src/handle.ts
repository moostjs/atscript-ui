import {
  handleWfOutletRequest,
  type WfOutletTriggerConfig,
  type WfOutletTriggerDeps,
} from "@moostjs/event-wf";

/**
 * Top-level keys `<AsWfForm>` routes on (`packages/vue-wf/src/use-wf-form.ts:128-167`)
 * plus `inputRequired` (form-pause envelope). Anything carrying one of these reaches
 * the client root intact; only "bare" finished payloads need a `finished: true` marker.
 */
const MARKER_KEYS = ["inputRequired", "finished", "error", "sent", "outlet"] as const;

/**
 * Wrap an unmarked plain-object result in `{ finished: true, ...result }` — the marker
 * `<AsWfForm>` reads to fire `@finished`. Pass-through for `null`/`undefined`, arrays,
 * primitives (incl. redirect's empty-string body), and already-marked envelopes.
 */
export function wrapFinished(result: unknown): unknown {
  if (
    result !== null &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    !MARKER_KEYS.some((k) => k in (result as object))
  ) {
    return { finished: true, ...(result as Record<string, unknown>) };
  }
  return result;
}

/**
 * Drop-in wrapper around `handleWfOutletRequest` that compensates for
 * `@wooksjs/event-wf`'s unwrap of `useWfFinished().set({ value })` (wooks index.mjs:198).
 * Steps return their domain data via `value` and the wrapper supplies the `finished: true`
 * marker so `<AsWfForm>` fires `@finished` instead of falling into "Unexpected response format".
 */
export async function handleAsOutletRequest(
  config: WfOutletTriggerConfig,
  deps: WfOutletTriggerDeps,
): Promise<unknown> {
  return wrapFinished(await handleWfOutletRequest(config, deps));
}
