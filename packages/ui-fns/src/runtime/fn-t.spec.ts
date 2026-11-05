import { Validator, defineAnnotatedType } from "@atscript/typescript/utils";
import {
  UI_FORM_FN_CLASSES,
  UI_FORM_FN_LABEL,
  UI_FORM_FN_OPTIONS,
  UI_FORM_FN_TITLE,
  UI_FORM_VALIDATE,
  UI_TABLE_FN_ATTR,
  UI_TABLE_FN_CLASSES,
  createUiTexts,
} from "@atscript/ui";
import { describe, expect, it } from "vitest";
import { DynamicFieldResolver } from "./dynamic-resolver";
import { compileFieldFn, compileTopFn } from "./fn-compiler";
import type { TFnScope } from "./types";
import { uiFnsValidatorPlugin } from "./validator-plugin";

/** An app's texts in `locale`, with what the server served for it (`$i18n`). */
function textsIn(locale: string, served: Record<string, string>) {
  const texts = createUiTexts({ locale: () => locale });
  texts.merge(locale, served);
  return texts;
}

const de = textsIn("de", {
  "Hello {name}": "Hallo {name}",
  "New order": "Neue Bestellung",
  "Name (set)": "Name (gesetzt)",
  "Not x": "Nicht x",
  "is-set": "ist-gesetzt",
  Red: "Rot",
});

function scope(t?: TFnScope["t"], v?: unknown): TFnScope {
  return { v, data: {}, context: {}, entry: undefined, t };
}

function prop(meta: Record<string, unknown>) {
  const h = defineAnnotatedType().designType("string");
  for (const [k, v] of Object.entries(meta)) h.annotate(k as keyof AtscriptMetadata, v as never);
  return h.$type;
}

describe("`t` in fn scope", () => {
  it("is the trailing argument of a field fn: served text, params filled", () => {
    const fn = compileFieldFn<string>("(v, data, ctx, entry, t) => t('Hello {name}', { name: v })");
    expect(fn(scope(de.t, "Bob"))).toBe("Hallo Bob");
  });

  it("is the trailing argument of a form-level fn", () => {
    const fn = compileTopFn<string>("(data, ctx, t) => t('New order')");
    expect(fn(scope(de.t))).toBe("Neue Bestellung");
  });

  it("falls back to the text itself (params filled) without served texts", () => {
    const fn = compileFieldFn<string>("(v, data, ctx, entry, t) => t('Hello {name}', { name: v })");
    // No `t` in scope: the active UI texts (English) — never a ReferenceError.
    expect(fn(scope(undefined, "Bob"))).toBe("Hello Bob");
    expect(fn(scope(textsIn("fr", {}).t, "Bob"))).toBe("Hello Bob");
  });

  it("keeps each scope's language (no module state per locale)", () => {
    const fr = textsIn("fr", { "Hello {name}": "Bonjour {name}" });
    const fn = compileFieldFn<string>("(v, data, ctx, entry, t) => t('Hello {name}', { name: v })");
    expect([fn(scope(de.t, "A")), fn(scope(fr.t, "B")), fn(scope(de.t, "C"))]).toEqual([
      "Hallo A",
      "Bonjour B",
      "Hallo C",
    ]);
  });
});

describe("text results of fns", () => {
  const resolver = new DynamicFieldResolver();
  const resolve = (meta: Record<string, unknown>, key: string, t = de.t) =>
    resolver.resolveFieldProp(prop(meta), key, undefined, scope(t, "x") as never);

  it("shows a text result the server translated, translated", () => {
    expect(
      resolve({ [UI_FORM_FN_LABEL]: "(v) => v ? 'Name (set)' : 'Name'" }, UI_FORM_FN_LABEL),
    ).toBe("Name (gesetzt)");
    const type = prop({ [UI_FORM_FN_TITLE]: "() => 'New order'" });
    expect(resolver.resolveFormProp(type, UI_FORM_FN_TITLE, undefined, scope(de.t) as never)).toBe(
      "Neue Bestellung",
    );
  });

  it("leaves a result that is no served text, and non-text fns, as they are", () => {
    expect(resolve({ [UI_FORM_FN_LABEL]: "() => 'Other'" }, UI_FORM_FN_LABEL)).toBe("Other");
    // A class name the dictionary happens to hold is not a text.
    expect(resolve({ [UI_FORM_FN_CLASSES]: "() => 'is-set'" }, UI_FORM_FN_CLASSES)).toBe("is-set");
  });

  it("translates computed option labels, never their keys", () => {
    expect(
      resolve(
        { [UI_FORM_FN_OPTIONS]: "() => [{ key: 'red', label: 'Red' }, 'Red']" },
        UI_FORM_FN_OPTIONS,
      ),
    ).toEqual([{ key: "red", label: "Rot" }, "Red"]);
  });

  it("reports a @ui.form.validate message the server translated, translated", () => {
    const type = prop({ [UI_FORM_VALIDATE]: ["(v) => v !== 'x' || 'Not x'"] });
    const validator = new Validator(type, { plugins: [uiFnsValidatorPlugin()] });
    expect(validator.validate("x", true, { data: {}, context: {}, t: de.t })).toBe(false);
    expect(validator.errors[0]!.message).toBe("Nicht x");
    expect(validator.validate("x", true, { data: {}, context: {} })).toBe(false);
    expect(validator.errors[0]!.message).toBe("Not x");
  });

  it("words a rule that returns `false` as UI_VALIDATION_FAILED, in the app's language", () => {
    const type = prop({ [UI_FORM_VALIDATE]: ["(v) => v !== 'x'"] });
    const validator = new Validator(type, { plugins: [uiFnsValidatorPlugin()] });
    const texts = textsIn("de", { UI_VALIDATION_FAILED: "Prüfung fehlgeschlagen" });
    expect(validator.validate("x", true, { data: {}, context: {}, t: texts.t })).toBe(false);
    expect(validator.errors[0]!.message).toBe("Prüfung fehlgeschlagen");
    expect(validator.validate("x", true, { data: {}, context: {} })).toBe(false);
    expect(validator.errors[0]!.message).toBe("Validation failed");
  });
});

describe("computed options keep what does not change", () => {
  const resolver = new DynamicFieldResolver();
  const shared = [{ key: "red", label: "Red" }, { key: "x", label: "Other" }, "Red"];
  const resolve = (t: TFnScope["t"]) =>
    resolver.resolveFieldProp(
      prop({ [UI_FORM_FN_OPTIONS]: "(v, data, ctx) => ctx.options" }),
      UI_FORM_FN_OPTIONS,
      undefined,
      { ...scope(t), context: { options: shared } } as never,
    ) as unknown[];

  it("returns the fn's own list when no label is translated", () => {
    expect(resolve(textsIn("fr", {}).t)).toBe(shared);
  });

  it("copies only the options whose label changes; never touches the shared list", () => {
    const out = resolve(de.t);
    expect(out).not.toBe(shared);
    expect(out[0]).toEqual({ key: "red", label: "Rot" });
    expect(out[1]).toBe(shared[1]);
    expect(shared[0]).toEqual({ key: "red", label: "Red" });
  });
});

describe("@ui.table.fn.* — called as (row, ctx, t)", () => {
  const resolver = new DynamicFieldResolver();
  const cell = (meta: Record<string, unknown>, key: string, t?: TFnScope["t"]) =>
    resolver.resolveFieldProp(prop(meta), key, undefined, {
      row: { status: "paid" },
      ctx: { rowIndex: 2 },
      t,
    } as never);

  it("gets the row and the table context", () => {
    expect(
      cell(
        { [UI_TABLE_FN_CLASSES]: "(row, ctx) => row.status + '-' + ctx.rowIndex" },
        UI_TABLE_FN_CLASSES,
      ),
    ).toBe("paid-2");
  });

  it("attrs get `t` (the active UI texts without one)", () => {
    const meta = {
      [UI_TABLE_FN_ATTR]: [
        { name: "title", fn: "(row, ctx, t) => t('Hello {name}', { name: row.status })" },
      ],
    };
    expect(cell(meta, UI_TABLE_FN_ATTR, de.t)).toEqual({ title: "Hallo paid" });
    expect(cell(meta, UI_TABLE_FN_ATTR)).toEqual({ title: "Hello paid" });
  });
});
