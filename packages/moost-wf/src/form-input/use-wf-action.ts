import { current } from "@wooksjs/event-core";
import { actionKey } from "./wf-keys";

/**
 * Composable that reads and writes the workflow action from the event context.
 *
 * **In the HTTP trigger** (to set the action from the request body):
 * ```ts
 * const { setAction } = useWfAction()
 * setAction(body.action)
 * ```
 *
 * **In step handlers** (to read the action — prefer `@AltAction()` decorator):
 * ```ts
 * const { getAction } = useWfAction()
 * const action = getAction()
 * ```
 */
export function useWfAction() {
  const ctx = current();
  return {
    getAction: () => (ctx.has(actionKey) ? ctx.get(actionKey) : undefined),
    setAction: (action: string | undefined) => ctx.set(actionKey, action),
  };
}
