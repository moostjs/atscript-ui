import { describe, expect, it } from "vitest";
import { createAsExtractor } from "../extractor";
import { componentClasses, helperAliases } from "../generated/component-classes";

function run(code: string, opts?: { excludeComponents?: string[] }): Set<string> | undefined {
  const extract = createAsExtractor(opts).extract!;
  const result = extract({ code } as Parameters<typeof extract>[0]);
  if (result == null) return undefined;
  if (result instanceof Set) return result as Set<string>;
  return new Set<string>(result as Iterable<string>);
}

const expectAllOf = (set: Set<string> | undefined, classes: readonly string[]) => {
  expect(set).toBeDefined();
  for (const cls of classes) expect(set).toContain(cls);
};

const expectNoneOf = (set: Set<string> | undefined, classes: readonly string[]) => {
  if (!set) return;
  for (const cls of classes) expect(set.has(cls)).toBe(false);
};

describe("createAsExtractor", () => {
  it("returns undefined for empty input", () => {
    expect(run("")).toBeUndefined();
  });

  it("returns undefined when no patterns match", () => {
    expect(run("const x = 1; export default x;")).toBeUndefined();
  });

  it("ignores unknown As* identifiers without throwing", () => {
    expect(run("<AsDoesNotExist />")).toBeUndefined();
    expect(run("import { AsBogus } from '@atscript/vue-form';")).toBeUndefined();
  });

  describe("Pattern 1: subpath imports", () => {
    it("matches @atscript/vue-form/<as-*>", () => {
      const out = run(`import AsForm from "@atscript/vue-form/as-form";`);
      expectAllOf(out, componentClasses["as-form"]);
    });

    it("matches @atscript/vue-table/<as-*>", () => {
      const out = run(`import AsTable from "@atscript/vue-table/as-table";`);
      expectAllOf(out, componentClasses["as-table"]);
    });

    it("matches @atscript/vue-wf/<as-*>", () => {
      const out = run(`import AsWfForm from "@atscript/vue-wf/as-wf-form";`);
      expectAllOf(out, componentClasses["as-wf-form"]);
    });

    it("rejects unrelated package subpaths", () => {
      expect(run(`import x from "@some-other/pkg/as-form";`)).toBeUndefined();
    });
  });

  describe("Pattern 2: barrel named imports", () => {
    it("matches a single import", () => {
      const out = run(`import { AsForm } from "@atscript/vue-form";`);
      expectAllOf(out, componentClasses["as-form"]);
    });

    it("matches multiple identifiers in one import", () => {
      const out = run(`import { AsForm, AsField } from "@atscript/vue-form";`);
      expectAllOf(out, componentClasses["as-form"]);
      expectAllOf(out, componentClasses["as-field"]);
    });

    it("strips `as` aliases and resolves on the source name", () => {
      const out = run(`import { AsForm as Form } from "@atscript/vue-form";`);
      expectAllOf(out, componentClasses["as-form"]);
    });

    it("matches type-only imports", () => {
      const out = run(`import type { AsForm } from "@atscript/vue-form";`);
      expectAllOf(out, componentClasses["as-form"]);
    });

    it("matches imports across all three packages", () => {
      const out = run(
        [
          `import { AsForm } from "@atscript/vue-form";`,
          `import { AsTable } from "@atscript/vue-table";`,
          `import { AsWfForm } from "@atscript/vue-wf";`,
        ].join("\n"),
      );
      expectAllOf(out, componentClasses["as-form"]);
      expectAllOf(out, componentClasses["as-table"]);
      expectAllOf(out, componentClasses["as-wf-form"]);
    });

    it("ignores non-As identifiers (e.g. helpers, types) inside the named list", () => {
      const out = run(
        `import { AsForm, createDefaultTypes, type FormDef } from "@atscript/vue-form";`,
      );
      expectAllOf(out, componentClasses["as-form"]);
      // `createDefaultTypes` here is just imported (no parens), so the helper-call
      // pattern must NOT fire and the helper's expansion must NOT be in the set.
      const helperOnly = helperAliases.createDefaultTypes
        .flatMap((n) => componentClasses[n])
        .filter((cls) => !componentClasses["as-form"].includes(cls));
      expectNoneOf(out, helperOnly);
    });
  });

  describe("Pattern 3: PascalCase tags", () => {
    it("matches simple tags", () => {
      const out = run(`<template><AsForm /></template>`);
      expectAllOf(out, componentClasses["as-form"]);
    });

    it("kebab-cases compound names correctly", () => {
      expectAllOf(run(`<AsWfForm />`), componentClasses["as-wf-form"]);
      expectAllOf(run(`<AsTableRoot />`), componentClasses["as-table-root"]);
      expectAllOf(run(`<AsFilterDialog />`), componentClasses["as-filter-dialog"]);
    });

    it("matches inside .vue templates with props", () => {
      const out = run(`<AsTable :rows="rows" @sort="handleSort">`);
      expectAllOf(out, componentClasses["as-table"]);
    });
  });

  describe("Pattern 4: kebab-case tags", () => {
    it("matches simple tags", () => {
      expectAllOf(run(`<as-form />`), componentClasses["as-form"]);
    });

    it("matches compound names", () => {
      expectAllOf(run(`<as-wf-form />`), componentClasses["as-wf-form"]);
      expectAllOf(run(`<as-table-root />`), componentClasses["as-table-root"]);
    });
  });

  describe("Pattern 5: helper-function calls", () => {
    it("expands createDefaultTypes() to all 11 form components", () => {
      const out = run(`const types = createDefaultTypes();`);
      const expected = helperAliases.createDefaultTypes.flatMap((n) => componentClasses[n]);
      expectAllOf(out, expected);
    });

    it("expands createDefaultTableComponents() to all 7 table components", () => {
      const out = run(`const components = createDefaultTableComponents();`);
      const expected = helperAliases.createDefaultTableComponents.flatMap(
        (n) => componentClasses[n],
      );
      expectAllOf(out, expected);
    });

    it("expands when called with arguments", () => {
      const out = run(`const t = createDefaultTypes({ extra: MyInput });`);
      expectAllOf(
        out,
        helperAliases.createDefaultTypes.flatMap((n) => componentClasses[n]),
      );
    });
  });

  describe("excludeComponents opt-out", () => {
    it("drops a single excluded component's classes from a helper call", () => {
      const out = run(`createDefaultTableComponents();`, {
        excludeComponents: ["as-filter-dialog"],
      });
      // Other components still present
      expectAllOf(out, componentClasses["as-config-dialog"]);
      expectAllOf(out, componentClasses["as-column-menu"]);
      // Excluded component's exclusive classes are not added (a class that
      // appears in as-filter-dialog and only as-filter-dialog must be absent).
      const excluded = componentClasses["as-filter-dialog"];
      const otherHelperClasses = new Set(
        helperAliases.createDefaultTableComponents
          .filter((n) => n !== "as-filter-dialog")
          .flatMap((n) => componentClasses[n]),
      );
      const exclusiveToFilterDialog = excluded.filter((c) => !otherHelperClasses.has(c));
      expect(exclusiveToFilterDialog.length).toBeGreaterThan(0);
      expectNoneOf(out, exclusiveToFilterDialog);
    });

    it("drops classes from a direct PascalCase tag match", () => {
      const out = run(`<AsFilterDialog />`, { excludeComponents: ["as-filter-dialog"] });
      expect(out).toBeUndefined();
    });

    it("drops classes from a barrel import", () => {
      const out = run(`import { AsFilterDialog } from "@atscript/vue-table";`, {
        excludeComponents: ["as-filter-dialog"],
      });
      expect(out).toBeUndefined();
    });
  });

  describe("multi-pattern files", () => {
    it("unions matches across all five patterns in one source", () => {
      const code = [
        `import { AsForm, AsField } from "@atscript/vue-form";`,
        `import AsTable from "@atscript/vue-table/as-table";`,
        `const types = createDefaultTypes();`,
        `<template><as-wf-form><AsTableRoot /></as-wf-form></template>`,
      ].join("\n");
      const out = run(code);
      expectAllOf(out, componentClasses["as-form"]);
      expectAllOf(out, componentClasses["as-field"]);
      expectAllOf(out, componentClasses["as-table"]);
      expectAllOf(out, componentClasses["as-wf-form"]);
      expectAllOf(out, componentClasses["as-table-root"]);
      expectAllOf(
        out,
        helperAliases.createDefaultTypes.flatMap((n) => componentClasses[n]),
      );
    });
  });
});
