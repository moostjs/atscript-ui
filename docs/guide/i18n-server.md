# Translations on the server

A moost server with a translator serves workflow forms in the user's language:
labels, placeholders, validation messages, finish screens and the built-in UI
texts the browser shows. The browser only says which language it wants
(`Accept-Language`, sent by `<AsWfForm>` from
[`provideAsLocale`](/guide/i18n)).

```ts
// server: main.ts
import { setTranslator } from "moost";

setTranslator({
  en: {}, // the source language first: the default locale
  de: {
    "First name": "Vorname", // a model text: the text is its own id
    MIN_LENGTH: "Mindestens {min} Zeichen", // a validator message: by code
    UI_CANCEL: "Abbrechen", // a built-in UI text: by code
  },
});
```

That is all: `@atscript/moost-wf` registers the message catalogs its forms
need when it is imported, and every form step answers in the request's
language. `setTranslator` also takes a function (i18next, FormatJS, …) — see
moost's i18n docs for the translator contract and how the request's locale is
picked.

## What a workflow serves translated

| What                                                                                      | Translated by                                                     |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Form schema texts: `@meta.label`, `@meta.description`, constraint messages, `@ui.*` texts | the text itself                                                   |
| Validation errors of `resolveInput()` / `@WfInput()`                                      | the error's code (`MIN_LENGTH`), params filled                    |
| `requireInput({ errors, formMessage })`                                                   | the text you pass                                                 |
| `finishWf` / `abortWf`: `message.text`, button labels, `skipButton.label`                 | the text you pass                                                 |
| `$i18n` on the form schema                                                                | — the client's dictionary: message templates and expression texts |

The `@ui.*` texts are `placeholder`, `hint`, option labels, `submit.text`,
`label.singular`, action labels, `prefix` / `suffix`, `literalLabel` labels,
`nav.group` and the array add / remove labels. An option without a value
keeps its source label as its value, so submitted values never depend on the
language. `@ui.form.attr` values, class names and styles are not texts.

The workflow's state and context are never translated: they are data. For the
languages in the translator's `locales` (a map's keys, or the `locales`
option), the schema is computed once per form and language — and per
translator `scope` (a tenant, a brand) when the translator has one — and reused
for every request; any other locale is translated per request.

## `$i18n` — what the browser translates itself

The form schema carries `$i18n`, merged by `<AsWfForm>` into the app's texts:

- the validator's message templates (`MIN_LENGTH`, …) and the built-in UI texts
  (`UI_*`) in the request's language, with `{name}` placeholders kept;
- the translated string literals of the form's expressions
  (`@ui.form.fn.label`, `@ui.form.fn.value`, `@ui.form.validate`, …): a result
  that is exactly one of them is shown translated, and `t(text, params)` in an
  expression reads them — the way to translate the text of a display-only
  `ui.paragraph`.
  See [Texts in the user's language](/forms/dynamic-fields#texts-in-the-users-language).

Only entries that differ from English are sent. `$i18n` is also what marks a
schema as translated by the server: it is present whenever the server translated
the schema, even as an empty `{}`, and the client then does not translate the
schema's texts a second time. An older server (`@atscript/moost-wf` before
0.1.170; `@atscript/moost-db` before 0.1.175 for `/meta` and action forms) can
omit an empty `$i18n`: upgrade server and client together.

## Registered templates are public

Every template registered with moost's `registerMessages` is sent, translated,
in the `$i18n` of every form schema (and of `/meta` responses of
`@atscript/moost-db`). Register only texts a user may see — never secrets or
internal messages.

## Tables without workflows

`@atscript/moost-db` (_since 0.1.170_) serves `/meta` and action forms in the
request's language with their own `$i18n`, which tables, value help and
action forms merge into the app's texts
([Tables, value help and action forms](/guide/i18n#tables-value-help-and-action-forms)).
`@atscript/moost-wf` registers `AS_UI_MESSAGES` on import. An app that serves
tables but no workflow forms registers the built-in UI texts once itself, so
`/meta` carries them translated:

```ts
import { registerMessages } from "moost";
import { AS_UI_MESSAGES } from "@atscript/ui/messages";

registerMessages(AS_UI_MESSAGES);
```

## Opting out

`serializeFormSchema(Form, { translate: false })`,
`useAtscriptWf(Form, { translate: false })` and `@WfInput({ translate: false })`
serve a form's source texts — for wording that depends on more than the
language (per tenant, per role), which the per-language schema cache cannot
hold. Error messages and finish texts are still translated per request.

## DOs and DON'Ts

- **Do** write texts as whole literals in expressions (`t("Hello {name}", { name })`),
  never `"Hello " + name`.
- **Do** branch on error `code`s, never on messages. The abort `reason` is a
  machine value and is never translated: put the user-facing text in `message`.
- **Don't** translate texts yourself before passing them to `finishWf` or
  `requireInput`: pass the source text, the server translates it.
- **Do** recompile your `.as` forms with this `@atscript/ui` version before you
  turn a translator on: forms compiled by an older plugin carry options without
  explicit values, whose value would then follow the translated label.
- Labels derived from field names (no `@meta.label`) are not translated —
  give translatable fields a `@meta.label`.

## See also

- [Language & Translations](/guide/i18n): the client side, `provideAsLocale`.
- [@atscript/moost-wf reference](/api/moost-wf): `serializeFormSchema`,
  `useAtscriptWf`, `finishWf`.
- [Finish Screens](/workflows/finish-screens).
