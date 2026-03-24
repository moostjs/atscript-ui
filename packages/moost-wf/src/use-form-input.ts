import { useWfState } from "@moostjs/event-wf";
import { isAnnotatedType } from "@atscript/typescript/utils";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { FormInputRequired } from "./form-input-required";
import { serializeFormSchema } from "./serialize";
import { extractPassContext } from "./context";

/**
 * Composable that provides access to form data and the `requireInput()` helper
 * inside workflow step handlers.
 *
 * Called by the `@FormInput()` Resolve callback. Can also be used standalone
 * when you need to manually re-pause with errors:
 *
 * ```ts
 * const { requireInput } = useFormInput()
 * throw requireInput({ password: 'Invalid credentials' })
 * ```
 */
export function useFormInput(type?: TAtscriptAnnotatedType) {
  const wfState = useWfState();

  /**
   * Returns the current form input data from the workflow event.
   */
  function data<T = unknown>(): T | undefined {
    return wfState.input<T | undefined>();
  }

  /**
   * Creates a FormInputRequired signal that re-pauses the workflow
   * with the serialized form schema, whitelisted context, and optional errors.
   *
   * Usage: `throw requireInput({ fieldName: 'Error message' })`
   */
  function requireInput(errors?: Record<string, string>): FormInputRequired {
    if (!type || !isAnnotatedType(type)) {
      throw new Error(
        "useFormInput(): no atscript type available. " +
          "Ensure @FormInput() is applied on the same method parameter.",
      );
    }
    const wfContext = wfState.ctx<Record<string, unknown>>();
    const schema = serializeFormSchema(type);
    const context = extractPassContext(type, wfContext);
    return new FormInputRequired(schema, errors, context);
  }

  return { data, requireInput };
}
