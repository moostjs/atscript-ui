import { describe, expect, it } from "vitest";
import { type AsExtractorOptions, createAsExtractor } from "../extractor";
import {
  type AsComponentName,
  componentClasses,
  componentCompanions,
  getComponentClasses,
  helperAliases,
} from "../generated/component-classes";

function run(code: string, opts?: AsExtractorOptions): Set<string> | undefined {
  const extract = createAsExtractor(opts).extract!;
  const result = extract({ code } as Parameters<typeof extract>[0]);
  if (result == null) return undefined;
  if (result instanceof Set) return result as Set<string>;
  return new Set<string>(result as Iterable<string>);
}

/** Independent oracle mirroring the expansion semantics: own classes +
 * transitively expanded companions, each veto-able by `exclude`. Kept
 * deliberately separate from the runtime walk (companions.ts) so the
 * exclude-aware assertions don't compare the implementation to itself. */
function expand(names: readonly string[], exclude: readonly string[] = []): Set<string> {
  const excluded = new Set(exclude);
  const out = new Set<string>();
  const visited = new Set<string>();
  const stack = [...names];
  while (stack.length > 0) {
    const name = stack.pop() as string;
    if (visited.has(name) || excluded.has(name)) continue;
    visited.add(name);
    for (const cls of componentClasses[name] ?? []) out.add(cls);
    for (const companion of componentCompanions[name as AsComponentName] ?? [])
      stack.push(companion);
  }
  return out;
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
      const formExpansion = new Set(getComponentClasses(["as-form"]));
      const helperOnly = getComponentClasses(helperAliases.createDefaultTypes).filter(
        (cls) => !formExpansion.has(cls),
      );
      expect(helperOnly.length).toBeGreaterThan(0);
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

    it("expands createDefaultControls() to all 7 table components", () => {
      const out = run(`const controls = createDefaultControls();`);
      const expected = helperAliases.createDefaultControls.flatMap((n) => componentClasses[n]);
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
      const out = run(`createDefaultControls();`, {
        excludeComponents: ["as-filter-dialog"],
      });
      // Other components still present
      expectAllOf(out, componentClasses["as-config-dialog"]);
      expectAllOf(out, componentClasses["as-column-menu"]);
      // Exactly the classes reachable without as-filter-dialog are present;
      // classes reachable ONLY through it are absent.
      const full = expand(helperAliases.createDefaultControls);
      const without = expand(helperAliases.createDefaultControls, ["as-filter-dialog"]);
      const exclusiveToFilterDialog = [...full].filter((c) => !without.has(c));
      expect(exclusiveToFilterDialog.length).toBeGreaterThan(0);
      expectAllOf(out, [...without]);
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

    it("rejects names outside the generated AsComponentName union at compile time", () => {
      const make = () =>
        createAsExtractor({
          // @ts-expect-error — typo'd name is not part of the generated union
          excludeComponents: ["as-filterr-dialog"],
        });
      expect(make).not.toThrow();
    });
  });

  describe("companion expansion", () => {
    const dialogs = [
      "as-action-form-dialog",
      "as-config-dialog",
      "as-filter-dialog",
      "as-preset-dialog",
    ] as const;

    it("the generated map records the lazy dialogs as companions of as-table-root", () => {
      for (const dialog of dialogs) {
        expect(componentCompanions["as-table-root"]).toContain(dialog);
      }
    });

    it("matching <AsTableRoot> emits its companions' classes (lazy dialogs included)", () => {
      const out = run(`<AsTableRoot />`);
      for (const dialog of dialogs) expectAllOf(out, componentClasses[dialog]);
      // Full transitive expansion (companions of companions too)
      expectAllOf(out, getComponentClasses(["as-table-root"]));
    });

    it("matching the @atscript/vue-table/as-table-root subpath emits companion classes", () => {
      const out = run(`import AsTableRoot from "@atscript/vue-table/as-table-root";`);
      for (const dialog of dialogs) expectAllOf(out, componentClasses[dialog]);
    });

    it("excludeComponents vetoes individual companions while keeping the rest", () => {
      const excluded: AsComponentName[] = [
        "as-config-dialog",
        "as-filter-dialog",
        "as-preset-dialog",
      ];
      const out = run(`<AsTableRoot />`, { excludeComponents: excluded });
      const full = expand(["as-table-root"]);
      const kept = expand(["as-table-root"], excluded);
      const dropped = [...full].filter((c) => !kept.has(c));
      expect(dropped.length).toBeGreaterThan(0);
      // Own classes and the remaining companions are intact
      expectAllOf(out, componentClasses["as-table-root"]);
      expectAllOf(out, componentClasses["as-action-form-dialog"]);
      expectAllOf(out, [...kept]);
      // Nothing reachable only through the excluded dialogs leaks in
      expectNoneOf(out, dropped);
    });

    it("excluding the matched component suppresses it and the companions riding under it", () => {
      expect(run(`<AsTableRoot />`, { excludeComponents: ["as-table-root"] })).toBeUndefined();
    });
  });

  describe("getComponentClasses", () => {
    it("matches the oracle without exclusions", () => {
      expect(new Set(getComponentClasses(["as-table-root"]))).toEqual(expand(["as-table-root"]));
    });

    it("exclude drops the component's classes and stops traversal through it", () => {
      const excluded = ["as-filter-dialog", "as-preset-dialog"];
      const got = new Set(getComponentClasses(["as-table-root"], new Set(excluded)));
      expect(got).toEqual(expand(["as-table-root"], excluded));
      expect(got.size).toBeLessThan(expand(["as-table-root"]).size);
    });

    it("excluding a start name yields nothing for it", () => {
      expect(getComponentClasses(["as-form"], new Set(["as-form"]))).toEqual([]);
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
