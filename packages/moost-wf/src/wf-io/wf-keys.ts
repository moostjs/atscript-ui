import { key } from "@wooksjs/event-core";

/**
 * Internal event context key for the workflow action name.
 *
 * Not exported from the package barrel — HTTP triggers should call
 * `useWfAction().setAction(body.action)` before `wf.resume()`, and step
 * handlers should read via `@WfAction()` or `useAtscriptWf()`.
 */
export const actionKey = key<string | undefined>("wf.action");
