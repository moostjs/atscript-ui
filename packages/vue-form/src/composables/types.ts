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
  register: (id: symbol, registration: TFormFieldRegistration) => void;
  unregister: (id: symbol) => void;
}
