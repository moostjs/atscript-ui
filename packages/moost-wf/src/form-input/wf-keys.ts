import { key } from "@wooksjs/event-core";

/**
 * Event context key for the workflow action name.
 *
 * The HTTP trigger should set this before calling `wf.resume()`:
 * ```ts
 * import { current } from '@wooksjs/event-core'
 * import { actionKey } from '@atscript/moost-wf'
 * current().set(actionKey, body.action)
 * ```
 *
 * `@AltAction()` and `@FormInput()` read from this key.
 */
export const actionKey = key<string | undefined>("wf.action");
