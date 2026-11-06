// `@atscript/vue-form/locale` — the locale provider on its own: reading the
// app's UI texts from another package (a table, a workflow form) does not
// pull the form components in.
export {
  getAsServedTexts,
  injectAsTexts,
  provideAsLocale,
  provideAsServedTexts,
  useAsLocale,
  useAsTexts,
  useUiLocaleKey,
} from "./composables/use-as-locale";
export type { AsServedTexts, UseAsLocaleReturn } from "./composables/use-as-locale";
