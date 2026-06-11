/**
 * Single pending consent descriptor — fed via `@ui.form.attr` / `@ui.form.fn.attr`
 * on the consumer's `.as` schema.
 *
 * - `id` — value committed to the bound `string[]` when checked.
 * - `text` — checkbox label.
 * - `required` — non-empty string ⇒ mandatory consent; the string IS the
 *   surfaced error message. Empty/undefined ⇒ optional.
 */
export interface AsConsentArrayItem {
  id: string;
  text: string;
  required?: string;
}

/**
 * One password-policy descriptor as sent by the aooth backend.
 *
 * - `rule` — serialized function literal (e.g. `"(p) => p.length >= 8"`).
 *   Compiled + cached via `compileFieldFn` from `@atscript/ui-fns`, which
 *   shares the same FNPool already used for `@ui.form.fn.*` annotations.
 * - `description` — plain label shown to the user.
 * - `errorMessage` — backend-supplied wording reserved for future
 *   "show on submit failure" surfacing; not rendered today.
 */
export interface AsPasswordRulesPolicy {
  rule: string;
  description?: string;
  errorMessage?: string;
}

/**
 * Single SSO provider descriptor — fed via `@ui.form.attr` /
 * `@ui.form.fn.attr` on the consumer's `.as` schema (the aooth backend
 * supplies the resolved list at runtime).
 *
 * - `id` — committed to the bound model (`model.value = id`) on click and
 *   carried by the fired form action; identifies which provider the
 *   workflow should redirect to.
 * - `text` — rendered VERBATIM. The backend owns the full display string
 *   (e.g. "Continue with Google" for a main-stack button, "Discord" for a
 *   secondary chip). We never compose a "Continue with {name}" prefix.
 * - `icon` — optional CSS class painting the brand glyph (e.g.
 *   `i-logos-google-icon`). Applied as-is; the consumer owns the safelist /
 *   preset coverage, same contract as `prefixIcon`.
 * - `secondary` — `true` ⇒ renders as a compact chip below the "or" divider;
 *   omitted/false ⇒ renders as a full-width button in the main stack (the
 *   default).
 */
export interface AsSsoProvider {
  id: string;
  text: string;
  icon?: string;
  secondary?: boolean;
}
