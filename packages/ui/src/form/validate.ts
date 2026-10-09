import type {
  TAtscriptAnnotatedType,
  TValidatorOptions,
  TValidatorPlugin,
} from "@atscript/typescript/utils";
import { Validator } from "@atscript/typescript/utils";
import { createDbValidatorPlugin, type DbValidationContext } from "@atscript/db/validator";
import { DB_COLUMN_DERIVED, DB_REL_FK } from "../shared/annotation-keys";
import type { FormDef } from "./types";

/** Per-call options for the form validator function. */
export interface TFormValidatorCallOptions {
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
}

// ── Server-managed fields ────────────────────────────────────

const dbPlugin = createDbValidatorPlugin();
const INSERT_CONTEXT: DbValidationContext = { mode: "insert" };

/**
 * Always-on plugin for fields the server fills in, so a create form is not
 * blocked on them:
 * - `@db.column.derived` — read-only and server-computed: never validated
 *   (not even a loaded value, which the user could not fix).
 * - an absent `@db.default*` / `@db.column.version` value — delegated to
 *   `@atscript/db`'s own insert-mode rule, so the key list has one owner.
 *   `db.rel.FK` is kept out: a form fills the FK itself (no nested nav
 *   object), so an empty required FK must still fail.
 *
 * The db plugin reads its mode from the validation context, which here
 * carries the form's `{ data, context }` — it gets a view of `ctx` with the
 * insert context instead.
 */
const serverManagedPlugin: TValidatorPlugin = (ctx, def, value) => {
  if (def.metadata.has(DB_COLUMN_DERIVED)) return true;
  if (value !== undefined || def.metadata.has(DB_REL_FK)) return undefined;
  return dbPlugin(Object.create(ctx, { context: { value: INSERT_CONTEXT } }), def, value);
};

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
 * Returns a reusable validator function for a whole FormDef.
 *
 * Validator is created once and reused on every call.
 * ATScript's @expect.* validation runs automatically; server-managed db
 * fields (`@db.column.derived`, absent `@db.default*` / version) pass.
 * For custom `ui.fn.*` validators, install ui-fns and pass its plugin via `opts.plugins`.
 */
export function getFormValidator(
  def: FormDef,
  opts?: Partial<TValidatorOptions>,
): (callOpts: TFormValidatorCallOptions) => Record<string, string> {
  const validator = new Validator(def.type, {
    unknownProps: "ignore",
    ...opts,
    plugins: [serverManagedPlugin, ...defaultValidatorPlugins, ...(opts?.plugins ?? [])],
  });

  return (callOpts: TFormValidatorCallOptions) => {
    const isValid = validator.validate(callOpts.data, true, {
      data: callOpts.data,
      context: callOpts.context ?? {},
    });
    if (isValid) return {};

    const errors: Record<string, string> = {};
    for (const err of validator.errors) {
      errors[err.path] = err.message;
    }
    return errors;
  };
}

// ── Field-level validator ────────────────────────────────────

/** Options for createFieldValidator. */
export interface TFieldValidatorOptions {
  /** Only report errors at the root path (for structure/array container validation). */
  rootOnly?: boolean;
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

function skipsDescendants(prop: TAtscriptAnnotatedType): boolean {
  const kind = prop.type.kind;
  return kind === "object" || kind === "array" || kind === "tuple";
}

/**
 * Creates a cached validator function for a single ATScript prop.
 *
 * The `Validator` instance is created lazily on first call and reused.
 * Returns `true` when valid, or the first error message string when invalid.
 * With `rootOnly`, an object / array / tuple prop is validated at its root
 * only (descendants are not walked — their errors would be discarded anyway).
 */
export function createFieldValidator(
  prop: TAtscriptAnnotatedType,
  opts?: TFieldValidatorOptions,
): (value: unknown, externalCtx?: { data: unknown; context: unknown }) => true | string {
  let cached: InstanceType<typeof Validator> | undefined;

  return (value: unknown, externalCtx?: { data: unknown; context: unknown }): true | string => {
    cached ??= new Validator(prop, {
      plugins:
        opts?.rootOnly && skipsDescendants(prop)
          ? [skipDescendantsPlugin, serverManagedPlugin, ...defaultValidatorPlugins]
          : [serverManagedPlugin, ...defaultValidatorPlugins],
    });
    const isValid = cached.validate(value, true, externalCtx);
    if (!isValid) {
      if (opts?.rootOnly) {
        const rootError = cached.errors?.find((e) => e.path === "");
        if (rootError) return rootError.message;
        return true;
      }
      return cached.errors?.[0]?.message || "Invalid value";
    }
    return true;
  };
}
