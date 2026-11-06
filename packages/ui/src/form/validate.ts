import type {
  TAtscriptAnnotatedType,
  TError,
  TValidatorOptions,
  TValidatorPlugin,
} from "@atscript/typescript/utils";
import { localizeErrors, normalizeForType, Validator } from "@atscript/typescript/utils";
import { createDbValidatorPlugin, type DbValidationContext } from "@atscript/db/validator";
import { DB_COLUMN_DERIVED, DB_REL_FK } from "../shared/annotation-keys";
import { isSkippedNavField } from "./skipped-nav";
import { validatorErrorsToMap } from "./error-utils";
import type { FormDef, FormFieldDef } from "./types";
import { childFields } from "./types";
import { getUiTexts, type UiT } from "../i18n/ui-texts";

/** Per-call options for the form validator function. */
export interface TFormValidatorCallOptions {
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
  /**
   * The app's texts: the `t` of `@ui.form.validate` rules and the language of
   * every message — validator messages are looked up by their code
   * (`MIN_LENGTH`, with the error's params) or, for a message of your own, by
   * its text: your translator first, then the texts the server served
   * (`/meta` `$i18n`). The active UI texts when omitted.
   */
  t?: UiT;
}

/** A form validator, see {@link getFormValidator}. Since 0.1.165 (before: a plain function). */
export interface FormValidator {
  (callOpts: TFormValidatorCallOptions): Record<string, string>;
  /**
   * `data` with the type's `@normalize.*` applied (trimmed, case-folded, …),
   * judged with this validator's options — the value to validate and to
   * submit. Copy-on-change: `data` itself when nothing changes; never
   * validates. Since 0.1.165.
   */
  normalize<T>(data: T): T;
}

/**
 * `error`'s message in the language of `t` (looked up by code or text, see
 * {@link TFormValidatorCallOptions.t}); the English message when `t` has none.
 * Its `details` are dropped first: only the message is read.
 */
function messageIn(error: TError, t: UiT): string {
  return localizeErrors([{ ...error, details: undefined }], (id, params) => {
    const text = t(id, params);
    return text === id ? undefined : text;
  })[0].message;
}

// ── Server-managed fields ────────────────────────────────────

const dbPlugin = createDbValidatorPlugin();
const INSERT_CONTEXT: DbValidationContext = { mode: "insert" };

/**
 * Always-on plugin for fields the server fills in, so a create form is not
 * blocked on them:
 * - `@db.column.derived` — read-only and server-computed: never validated
 *   (not even a loaded value, which the user could not fix).
 * - a navigation field the form leaves out (`isSkippedNavField`): loaded
 *   related rows the form neither renders nor sends.
 * - an absent `@db.default*` / `@db.column.version` / `@db.onUpdate.inc` value
 *   — delegated to `@atscript/db`'s own insert-mode rule, so the key list has
 *   one owner.
 *   `db.rel.FK` is kept out: a form fills the FK itself (no nested nav
 *   object), so an empty required FK must still fail.
 *
 * The db plugin reads its mode from the validation context, which here
 * carries the form's `{ data, context }` — it gets a view of `ctx` with the
 * insert context instead.
 */
const serverManagedPlugin: TValidatorPlugin = (ctx, def, value) => {
  if (def.metadata.has(DB_COLUMN_DERIVED) || isSkippedNavField(def)) return true;
  if (value !== undefined || def.metadata.has(DB_REL_FK)) return undefined;
  return dbPlugin(Object.create(ctx, { context: { value: INSERT_CONTEXT } }), def, value);
};

/**
 * The props of the fields `createFormDef` marked `derived`, at any depth — a
 * computed view column (`metaFields`) or an edit form's update-stamped field
 * (see `CreateFormDefOptions.mode`) carries no annotation the plugin above
 * could read. The validator matches by prop, so a prop that is also used where
 * it is not derived (an interface's stamp below a union of several types, too)
 * stays validated. A recursive type's def graph is cyclic: each field def is
 * visited once.
 */
function collectDerivedProps(def: FormDef): Set<TAtscriptAnnotatedType> {
  const derived = new Set<TAtscriptAnnotatedType>();
  const kept = new Set<TAtscriptAnnotatedType>();
  const seen = new Set<FormFieldDef>();
  const walk = (fields: FormFieldDef[]): void => {
    for (const field of fields) {
      if (seen.has(field)) continue;
      seen.add(field);
      if (field.derived) {
        derived.add(field.prop);
        continue;
      }
      kept.add(field.prop);
      walk(childFields(field));
    }
  };
  walk(def.fields);
  for (const prop of kept) derived.delete(prop);
  return derived;
}

// ── Default validator plugin registry ────────────────────────
//
// Lets ui-fns (or any consumer) install validator plugins globally so
// `getFormValidator` / `createFieldValidator` pick them up without
// every caller having to thread plugins through.
let defaultValidatorPlugins: TValidatorPlugin[] = [];

/** Replace the default validator plugins applied to every form/field validator. */
export function setDefaultValidatorPlugins(plugins: TValidatorPlugin[]): void {
  defaultValidatorPlugins = plugins;
}

/** Get the currently registered default validator plugins. */
export function getDefaultValidatorPlugins(): TValidatorPlugin[] {
  return defaultValidatorPlugins;
}

/**
 * Returns a reusable validator for a whole FormDef.
 *
 * Validator is created once and reused on every call.
 * ATScript's @expect.* validation runs automatically; server-managed db
 * fields (every `derived` field, absent `@db.default*` / version) pass.
 * For custom `ui.fn.*` validators, install ui-fns and pass its plugin via `opts.plugins`.
 *
 * It validates the data as given: apply `@normalize.*` first with its
 * `normalize(data)` and validate (and submit) the result, as the server does.
 *
 * Errors are keyed by dotted path, worded in the language of `callOpts.t`.
 * A root-level error (a failing `@ui.form.validate` on the form's interface)
 * is keyed `__form`.
 */
export function getFormValidator(def: FormDef, opts?: Partial<TValidatorOptions>): FormValidator {
  const derived = collectDerivedProps(def);
  const derivedPlugin: TValidatorPlugin = (_ctx, prop) => (derived.has(prop) ? true : undefined);
  const options: Partial<TValidatorOptions> = {
    unknownProps: "ignore",
    ...opts,
    plugins: [
      ...(derived.size > 0 ? [derivedPlugin] : []),
      serverManagedPlugin,
      ...defaultValidatorPlugins,
      ...(opts?.plugins ?? []),
    ],
  };
  const validator = new Validator(def.type, options);

  const validate = (callOpts: TFormValidatorCallOptions) => {
    const isValid = validator.validate(callOpts.data, true, {
      data: callOpts.data,
      context: callOpts.context ?? {},
      t: callOpts.t,
    });
    if (isValid) return {};

    const t = callOpts.t ?? getUiTexts().t;
    return validatorErrorsToMap(
      validator.errors.map((e) => ({ path: e.path, message: messageIn(e, t) })),
    );
  };
  return Object.assign(validate, {
    normalize: <T>(data: T): T => normalizeForType(def.type, data, options),
  });
}

// ── Field-level validator ────────────────────────────────────

/** Options for createFieldValidator. */
export interface TFieldValidatorOptions {
  /** Only report errors at the root path (for structure/array container validation). */
  rootOnly?: boolean;
  /** Words the fallback error (`UI_INVALID_VALUE`); the active UI texts when omitted. */
  t?: UiT;
}

/**
 * Root-only plugin: passes every descendant without visiting it. Only
 * `object` / `array` / `tuple` roots use it — their root-path errors (shape,
 * length, a container-level `@ui.form.validate`) are all decided before the
 * walk descends, so skipping the children cannot change the root error. A
 * union or intersection root evaluates its branches AT the root path, where
 * a branch's verdict depends on its children — those keep the full walk.
 */
const skipDescendantsPlugin: TValidatorPlugin = (ctx) => (ctx.path === "" ? undefined : true);

/**
 * Whether a type kind is a container that carries its own children:
 * `object`, `array` or `tuple`. Union / intersection kinds are not
 * containers — they evaluate their branches at their own path.
 */
export function isContainerKind(kind: string): boolean {
  return kind === "object" || kind === "array" || kind === "tuple";
}

/**
 * Creates a cached validator function for a single ATScript prop.
 *
 * The `Validator` instance is created lazily on first call and reused.
 * Returns `true` when valid, or the first error message string when invalid,
 * worded in the language of `externalCtx.t` (else `opts.t`, else the active
 * UI texts) — looked up by the error's code, see {@link TFormValidatorCallOptions.t}.
 * The value is judged with the prop's `@normalize.*` applied, as a submit
 * judges it (the value itself is not changed).
 * With `rootOnly`, an object / array / tuple prop is validated at its root
 * only (descendants are not walked — their errors would be discarded anyway).
 */
export function createFieldValidator(
  prop: TAtscriptAnnotatedType,
  opts?: TFieldValidatorOptions,
): (value: unknown, externalCtx?: { data: unknown; context: unknown; t?: UiT }) => true | string {
  let cached: InstanceType<typeof Validator> | undefined;
  let options: Partial<TValidatorOptions>;
  // A container validated at its root only is not walked for normalizers:
  // they change strings inside it, which its own root checks (shape, length)
  // never read. Its children are judged normalized by their own fields.
  const rootOfContainer = opts?.rootOnly === true && isContainerKind(prop.type.kind);

  return (value, externalCtx) => {
    if (!cached) {
      options = {
        plugins: rootOfContainer
          ? [skipDescendantsPlugin, serverManagedPlugin, ...defaultValidatorPlugins]
          : [serverManagedPlugin, ...defaultValidatorPlugins],
      };
      cached = new Validator(prop, options);
    }
    const judged = rootOfContainer ? value : normalizeForType(prop, value, options);
    if (cached.validate(judged, true, externalCtx)) return true;
    const t = externalCtx?.t ?? opts?.t ?? getUiTexts().t;
    if (opts?.rootOnly) {
      const rootError = cached.errors?.find((e) => e.path === "");
      return rootError ? messageIn(rootError, t) : true;
    }
    const error = cached.errors?.[0];
    return (error && messageIn(error, t)) || t("UI_INVALID_VALUE");
  };
}
