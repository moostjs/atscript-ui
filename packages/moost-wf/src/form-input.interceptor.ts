import type { TInterceptorDef } from "moost";
import { TInterceptorPriority } from "moost";
import { FormInputRequired } from "./form-input-required";

/**
 * Global interceptor that catches {@link FormInputRequired} signals
 * thrown by step handlers (via `form.requireInput()`) and converts them
 * to `inputRequired` outlet responses.
 *
 * Apply globally:
 * ```ts
 * app.applyGlobalInterceptors(formInputInterceptor())
 * ```
 */
export function formInputInterceptor(): TInterceptorDef {
  return {
    priority: TInterceptorPriority.CATCH_ERROR,
    error(error, reply) {
      if (error instanceof FormInputRequired) {
        const context: Record<string, unknown> = { ...error.context };
        if (error.errors) {
          context.errors = error.errors;
        }
        reply({
          inputRequired: {
            payload: error.schema,
            transport: "http" as const,
            context,
          },
        });
      }
    },
  };
}
