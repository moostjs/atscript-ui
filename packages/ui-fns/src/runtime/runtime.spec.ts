import { defineAnnotatedType } from "@atscript/typescript/utils";
import {
  UI_DISABLED,
  UI_FN_DISABLED,
  UI_FN_HIDDEN,
  UI_FN_OPTIONS,
  UI_HIDDEN,
  getResolver,
  resolveFieldProp,
  resolveFormProp,
} from "@atscript/ui";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DynamicFieldResolver, buildFieldEntry } from "./dynamic-resolver";
import { compileFieldFn, compileTopFn, compileValidatorFn } from "./fn-compiler";
import { installDynamicResolver } from "../index";
import type { TFnScope } from "./types";

// ── fn-compiler ──────────────────────────────────────────────

describe("fn-compiler", () => {
  it("compileFieldFn compiles and executes a field-level function", () => {
    const fn = compileFieldFn<string>("(v) => v + '!'");
    const result = fn({ v: "hello", data: {}, context: {}, entry: undefined });
    expect(result).toBe("hello!");
  });

  it("compileFieldFn provides data and context in scope", () => {
    const fn = compileFieldFn<string>("(v, data, ctx) => data.name + ' ' + ctx.role");
    const result = fn({
      v: undefined,
      data: { name: "Alice" },
      context: { role: "admin" },
      entry: undefined,
    });
    expect(result).toBe("Alice admin");
  });

  it("compileFieldFn caches compiled functions", () => {
    const fn1 = compileFieldFn("(v) => v");
    const fn2 = compileFieldFn("(v) => v");
    // Same code string → same function reference (from FNPool cache)
    expect(fn1).toBe(fn2);
  });

  it("compileTopFn compiles a form-level function", () => {
    const fn = compileTopFn<number>("(data) => data.items.length");
    const result = fn({ data: { items: [1, 2, 3] }, context: {}, entry: undefined });
    expect(result).toBe(3);
  });

  it("compileValidatorFn returns true for valid", () => {
    const fn = compileValidatorFn("(v) => v.length > 0 ? true : 'Required'");
    expect(fn({ v: "ok", data: {}, context: {}, entry: undefined })).toBe(true);
  });

  it("compileValidatorFn returns error string for invalid", () => {
    const fn = compileValidatorFn("(v) => v.length > 0 ? true : 'Required'");
    expect(fn({ v: "", data: {}, context: {}, entry: undefined })).toBe("Required");
  });
});

// ── DynamicFieldResolver ─────────────────────────────────────

describe("DynamicFieldResolver", () => {
  beforeAll(() => {
    installDynamicResolver();
  });

  afterAll(() => {
    installDynamicResolver(); // keep dynamic resolver active (tests are isolated)
  });

  it("installDynamicResolver replaces the active resolver", () => {
    expect(getResolver()).toBeInstanceOf(DynamicFieldResolver);
  });

  it("resolves static field props", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    prop.metadata.set(UI_DISABLED as keyof AtscriptMetadata, true as never);

    const result = resolveFieldProp<boolean>(
      prop,
      UI_FN_DISABLED,
      UI_DISABLED,
      { v: undefined, data: {}, context: {}, entry: undefined },
      { staticAsBoolean: true },
    );
    expect(result).toBe(true);
  });

  it("resolves dynamic field props via fn compilation", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    prop.metadata.set(UI_FN_HIDDEN as keyof AtscriptMetadata, "(v, data) => data.hideAll" as never);

    const result = resolveFieldProp<boolean>(prop, UI_FN_HIDDEN, UI_HIDDEN, {
      v: undefined,
      data: { hideAll: true },
      context: {},
      entry: undefined,
    });
    expect(result).toBe(true);
  });

  it("fn key takes priority over static key", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    prop.metadata.set(UI_DISABLED as keyof AtscriptMetadata, true as never);
    prop.metadata.set(UI_FN_DISABLED as keyof AtscriptMetadata, "(v, data) => false" as never);

    const result = resolveFieldProp<boolean>(prop, UI_FN_DISABLED, UI_DISABLED, {
      v: undefined,
      data: {},
      context: {},
      entry: undefined,
    });
    expect(result).toBe(false);
  });

  it("resolves form-level props via compileTopFn", () => {
    const type = defineAnnotatedType("object").prop(
      "name",
      defineAnnotatedType().designType("string").$type,
    ).$type;
    type.metadata.set(
      "ui.fn.label" as keyof AtscriptMetadata,
      "(data) => 'Edit ' + data.name" as never,
    );

    const result = resolveFormProp<string>(type, "ui.fn.label", "meta.label", {
      data: { name: "User" },
      context: {},
      entry: undefined,
    });
    expect(result).toBe("Edit User");
  });

  it("hasComputedAnnotations detects ui.fn.* keys", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    expect(getResolver().hasComputedAnnotations(prop)).toBe(false);

    prop.metadata.set(UI_FN_HIDDEN as keyof AtscriptMetadata, "(v) => false" as never);
    expect(getResolver().hasComputedAnnotations(prop)).toBe(true);
  });
});

// ── buildFieldEntry ──────────────────────────────────────────

describe("buildFieldEntry", () => {
  beforeAll(() => {
    installDynamicResolver();
  });

  it("builds entry with static constraints", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    prop.metadata.set(UI_DISABLED as keyof AtscriptMetadata, true as never);

    const baseScope: TFnScope = { v: "test", data: {}, context: {}, entry: undefined };
    const scope = buildFieldEntry(prop, baseScope, "name");

    expect(scope.entry).toBeDefined();
    expect(scope.entry!.field).toBe("name");
    expect(scope.entry!.name).toBe("name");
    expect(scope.entry!.type).toBe("text");
    expect(scope.entry!.disabled).toBe(true);
  });

  it("builds entry with dynamic constraints", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    prop.metadata.set(
      UI_FN_DISABLED as keyof AtscriptMetadata,
      "(v, data) => data.lockAll" as never,
    );

    const baseScope: TFnScope = {
      v: "test",
      data: { lockAll: true },
      context: {},
      entry: undefined,
    };
    const scope = buildFieldEntry(prop, baseScope, "field1");

    expect(scope.entry!.disabled).toBe(true);
  });

  it("respects override opts", () => {
    const prop = defineAnnotatedType().designType("string").$type;

    const baseScope: TFnScope = { v: "test", data: {}, context: {}, entry: undefined };
    const scope = buildFieldEntry(prop, baseScope, "myField", {
      name: "custom",
      type: "textarea",
      disabled: false,
      hidden: true,
    });

    expect(scope.entry!.name).toBe("custom");
    expect(scope.entry!.type).toBe("textarea");
    expect(scope.entry!.disabled).toBe(false);
    expect(scope.entry!.hidden).toBe(true);
  });

  it("resolves options into entry via full scope", () => {
    const prop = defineAnnotatedType().designType("string").$type;
    prop.metadata.set(
      UI_FN_OPTIONS as keyof AtscriptMetadata,
      "(v, data, ctx, entry) => ['a', 'b', 'c']" as never,
    );

    const baseScope: TFnScope = { v: "test", data: {}, context: {}, entry: undefined };
    const scope = buildFieldEntry(prop, baseScope, "choice");

    expect(scope.entry!.options).toEqual(["a", "b", "c"]);
  });

  it("extracts name from dotted path", () => {
    const prop = defineAnnotatedType().designType("string").$type;

    const baseScope: TFnScope = { v: "", data: {}, context: {}, entry: undefined };
    const scope = buildFieldEntry(prop, baseScope, "address.city");

    expect(scope.entry!.name).toBe("city");
    expect(scope.entry!.field).toBe("address.city");
  });
});
