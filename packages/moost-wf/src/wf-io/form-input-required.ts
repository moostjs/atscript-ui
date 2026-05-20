/**
 * Thrown by @FormInput() to signal that the workflow should pause
 * and request form input from the client.
 *
 * Caught by {@link formInputInterceptor} and converted to an
 * `inputRequired` outlet response.
 */
export class FormInputRequired {
  constructor(
    public readonly schema: unknown,
    public readonly errors?: Record<string, string>,
    public readonly context?: Record<string, unknown>,
  ) {}
}
