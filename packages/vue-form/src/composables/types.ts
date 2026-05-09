export type TFormRule<TValue, TFormData, TContext> = (
  v: TValue,
  data?: TFormData,
  context?: TContext,
) => boolean | string;

export interface TFormFieldCallbacks {
  validate: () => boolean | string;
  clearErrors: () => void;
  reset: () => void;
  setExternalError: (msg?: string) => void;
}

export interface TFormFieldRegistration {
  path: () => string;
  callbacks: TFormFieldCallbacks;
}

export interface TFormState {
  firstSubmitHappened: boolean;
  firstValidation: "on-change" | "touched-on-blur" | "on-blur" | "on-submit" | "none";
  /**
   * Fields registered AFTER `firstSubmitHappened` flipped to true. They stay
   * in this set until either the user edits the field (model watch removes
   * the id) or the next submit fires (set is cleared). Live validation is
   * suppressed for these fields so a freshly-added array item doesn't render
   * red required-field errors before the user has had a chance to type.
   */
  freshFields: Set<symbol>;
  register: (id: symbol, registration: TFormFieldRegistration) => void;
  unregister: (id: symbol) => void;
}
