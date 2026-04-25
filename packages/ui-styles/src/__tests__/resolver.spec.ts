import { describe, expect, it } from "vitest";

import { AsResolver } from "../vite";

const resolver = AsResolver();
const resolve = resolver.resolve as (name: string) => { name: string; from: string } | undefined;

describe("AsResolver", () => {
  it("resolves a vue-form root component", () => {
    expect(resolve("AsForm")).toEqual({
      name: "default",
      from: "@atscript/vue-form/as-form",
    });
  });

  it("resolves a vue-table root component", () => {
    expect(resolve("AsTable")).toEqual({
      name: "default",
      from: "@atscript/vue-table/as-table",
    });
  });

  it("resolves a vue-wf root component", () => {
    expect(resolve("AsWfForm")).toEqual({
      name: "default",
      from: "@atscript/vue-wf/as-wf-form",
    });
  });

  it("resolves a multi-word PascalCase component", () => {
    expect(resolve("AsTableRoot")).toEqual({
      name: "default",
      from: "@atscript/vue-table/as-table-root",
    });
  });

  it("resolves a vue-table default component", () => {
    expect(resolve("AsFilterDialog")).toEqual({
      name: "default",
      from: "@atscript/vue-table/as-filter-dialog",
    });
  });

  it("returns undefined for non-As prefixed identifiers", () => {
    expect(resolve("Foo")).toBeUndefined();
    expect(resolve("Button")).toBeUndefined();
    expect(resolve("AppShell")).toBeUndefined();
  });

  it("returns undefined for As-prefixed but non-PascalCase identifiers", () => {
    expect(resolve("Asynchronous")).toBeUndefined();
    expect(resolve("Asset")).toBeUndefined();
  });

  it("returns undefined for unknown As* identifiers", () => {
    expect(resolve("AsBogus")).toBeUndefined();
    expect(resolve("AsDoesNotExist")).toBeUndefined();
  });

  it("returns undefined for composables (tag-only resolver)", () => {
    expect(resolve("useTable")).toBeUndefined();
    expect(resolve("useFormState")).toBeUndefined();
  });

  it("exposes type=component (so unplugin-vue-components treats it as a tag resolver)", () => {
    expect(resolver.type).toBe("component");
  });
});
