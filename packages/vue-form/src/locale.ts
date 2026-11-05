// `@atscript/vue-form/locale` — the locale provider on its own: reading the
// app's UI texts from another package (a table, a workflow form) does not
// pull the form components in.
export { provideAsLocale, useAsLocale, useAsTexts } from "./composables/use-as-locale";
export type { UseAsLocaleReturn } from "./composables/use-as-locale";
