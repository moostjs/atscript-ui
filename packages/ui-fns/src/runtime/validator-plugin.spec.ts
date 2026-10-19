import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "@atscript/core";
import { tsPlugin } from "@atscript/typescript";
import {
  Validator,
  defineAnnotatedType,
  type TAtscriptAnnotatedType,
} from "@atscript/typescript/utils";
import { UI_FORM_VALIDATE } from "@atscript/ui";
import uiPlugin from "@atscript/ui/plugin";
import { describe, expect, it } from "vitest";
import uiFnsPlugin from "../plugin";
import { uiFnsValidatorPlugin } from "./validator-plugin";

async function diagnostics(text: string): Promise<string[]> {
  const rootDir = mkdtempSync(join(tmpdir(), "ui-fns-validate-"));
  writeFileSync(join(rootDir, "t.as"), text);
  const repo = await build({
    rootDir,
    entries: ["t.as"],
    plugins: [tsPlugin(), uiPlugin(), uiFnsPlugin()],
  });
  const doc = repo.getDoc(`file://${join(rootDir, "t.as")}`)!;
  return doc.getDiagMessages().map((m) => m.message);
}

describe("@ui.form.validate placement", () => {
  it("is accepted on an interface, a type and a prop", async () => {
    const messages = await diagnostics(`
@ui.form.validate '(v) => v.password === v.confirm || "Passwords must match"'
export interface SignupForm {
    password: string
    confirm: string
}

@ui.form.validate '(v) => v.from <= v.to || "Invalid range"'
export type Range = {
    from: number
    to: number
}

export interface Host {
    @ui.form.validate '(v) => v.length > 2 || "Too short"'
    name: string
    signup: SignupForm
}
`);
    expect(messages).toEqual([]);
  });

  it("still rejects an invalid function string on an interface", async () => {
    const messages = await diagnostics(`
@ui.form.validate '(v) => {'
export interface Broken {
    a: string
}
`);
    expect(messages.join("\n")).toContain("Invalid function string");
  });
});

// ── Runtime ──────────────────────────────────────────────────

const str = (meta: Record<string, unknown> = {}) => {
  const t = defineAnnotatedType().designType("string").$type;
  for (const [k, v] of Object.entries(meta)) t.metadata.set(k as never, v as never);
  return t;
};
const obj = (props: Record<string, TAtscriptAnnotatedType>, validate?: string[]) => {
  const h = defineAnnotatedType("object");
  for (const [k, v] of Object.entries(props)) h.prop(k, v);
  if (validate) h.$type.metadata.set(UI_FORM_VALIDATE as never, validate as never);
  return h.$type;
};

const MATCH = '(v) => v.password === v.confirm || "Passwords must match"';
const required = () => str({ "expect.minLength": { length: 1, message: "Required" } });

function run(type: TAtscriptAnnotatedType, value: unknown, data = value) {
  const v = new Validator(type, { plugins: [uiFnsValidatorPlugin()], errorLimit: 100 });
  const ok = v.validate(value, true, { data, context: {} });
  return { ok, errors: v.errors.map((e) => [e.path, e.message]) };
}

describe("uiFnsValidatorPlugin — container-level rules", () => {
  const signup = () => obj({ password: required(), confirm: required() }, [MATCH]);

  it("reports a failing root rule at the root path", () => {
    expect(run(signup(), { password: "a", confirm: "b" })).toEqual({
      ok: false,
      errors: [["", "Passwords must match"]],
    });
  });

  it("passes when the root rule passes", () => {
    expect(run(signup(), { password: "a", confirm: "a" })).toEqual({ ok: true, errors: [] });
  });

  it("does not hide field-level errors", () => {
    const type = obj({ password: required(), confirm: required(), name: required() }, [MATCH]);
    const { ok, errors } = run(type, { password: "a", confirm: "", name: "" });
    expect(ok).toBe(false);
    expect(errors).toEqual([
      ["", "Passwords must match"],
      ["confirm", "Required"],
      ["name", "Required"],
    ]);
  });

  it("gets the whole object as value and the form data as data", () => {
    const type = obj({ a: str() }, [
      '(v, data) => (v === data.root && v.a === "x" ? "scope ok" : "scope wrong")',
    ]);
    const value = { a: "x" };
    expect(run(type, value, { root: value }).errors).toEqual([["", "scope ok"]]);
  });

  it("reports a nested object's rule at that prop's path", () => {
    const host = obj({ title: required(), account: signup() });
    const { ok, errors } = run(host, {
      title: "",
      account: { password: "a", confirm: "" },
    });
    expect(ok).toBe(false);
    expect(errors).toEqual([
      ["title", "Required"],
      ["account", "Passwords must match"],
      ["account.confirm", "Required"],
    ]);
  });

  it("respects errorLimit: the container error alone fills a limit of 1", () => {
    const v = new Validator(signup(), { plugins: [uiFnsValidatorPlugin()], errorLimit: 1 });
    const value = { password: "a", confirm: "" };
    expect(v.validate(value, true, { data: value, context: {} })).toBe(false);
    expect(v.errors.map((e) => [e.path, e.message])).toEqual([["", "Passwords must match"]]);
  });

  it("validates an array's items under a failing array rule", () => {
    const h = defineAnnotatedType("array").of(required());
    h.$type.metadata.set(UI_FORM_VALIDATE as never, ['(v) => v.length < 3 || "Too many"'] as never);
    expect(run(h.$type, ["a", "", "c"]).errors).toEqual([
      ["", "Too many"],
      ["1", "Required"],
    ]);
  });

  it("skips a container rule on a value of the wrong shape", () => {
    const host = obj({ account: signup() });
    expect(run(host, { account: null }).errors).toEqual([["account", "Expected object"]]);
  });

  it("stops at a failing leaf rule (no @expect.* errors on top)", () => {
    const type = obj({
      a: str({ "expect.minLength": { length: 5 }, [UI_FORM_VALIDATE]: ["() => 'bad'"] }),
    });
    expect(run(type, { a: "x" }).errors).toEqual([["a", "bad"]]);
  });
});
