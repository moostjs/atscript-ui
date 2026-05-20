import { current } from "@wooksjs/event-core";
import { actionKey } from "./wf-keys";

/**
 * Low-level accessor for the workflow action slot in the current wf event context.
 *
 * Used by:
 * - Transport adapters (HTTP / CLI / WS controllers) to **write** the action
 *   from the incoming request (`useWfActionSlot().setAction(body.action)`).
 * - Composable helpers that need to **read + clear** the slot atomically
 *   (e.g. one-shot action consumption patterns).
 *
 * In step handlers, prefer `useAtscriptWf(Type).resolveAction()` — it reads
 * the same slot but validates the value against the schema's
 * `@ui.form.action` / `@wf.action.withData` declarations and throws
 * `StepRetriableError` on unknown actions.
 *
 * **In a transport adapter** (to set the action from the request body):
 * ```ts
 * const { setAction } = useWfActionSlot()
 * setAction(body.action)
 * ```
 *
 * **In step handlers** (raw read — prefer `@WfAction()` / `useAtscriptWf().resolveAction()`):
 * ```ts
 * const { getAction } = useWfActionSlot()
 * const action = getAction()
 * ```
 */
export function useWfActionSlot() {
  const ctx = current();
  return {
    getAction: () => (ctx.has(actionKey) ? ctx.get(actionKey) : undefined),
    setAction: (action: string | undefined) => ctx.set(actionKey, action),
  };
}
