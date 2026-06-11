import { describe, expect, it, vi } from "vitest";

// The real companions graph is acyclic, so cycle-safety of the extractor's
// visited guard is exercised against a synthetic cyclic map:
// as-alpha -> as-beta -> as-gamma -> as-alpha.
vi.mock("../generated/component-classes", () => ({
  componentClasses: {
    "as-alpha": ["as-alpha-x"],
    "as-beta": ["as-beta-x"],
    "as-gamma": ["as-gamma-x"],
  },
  componentCompanions: {
    "as-alpha": ["as-beta"],
    "as-beta": ["as-gamma"],
    "as-gamma": ["as-alpha"],
  },
  helperAliases: {},
}));

import { type AsExtractorOptions, createAsExtractor } from "../extractor";

// Synthetic component names aren't part of the generated AsComponentName
// union, so the options are cast through the loose shape on purpose.
function run(code: string, opts?: { excludeComponents?: string[] }): Set<string> | undefined {
  const extract = createAsExtractor(opts as AsExtractorOptions).extract!;
  const result = extract({ code } as Parameters<typeof extract>[0]);
  if (result == null) return undefined;
  if (result instanceof Set) return result as Set<string>;
  return new Set<string>(result as Iterable<string>);
}

describe("createAsExtractor companion cycle safety", () => {
  it("terminates on a cyclic companions graph and unions all classes once", () => {
    const out = run(`<AsAlpha />`);
    expect(out).toEqual(new Set(["as-alpha-x", "as-beta-x", "as-gamma-x"]));
  });

  it("an excluded companion prunes its branch of the cycle", () => {
    const out = run(`<AsAlpha />`, { excludeComponents: ["as-beta"] });
    expect(out).toEqual(new Set(["as-alpha-x"]));
  });

  it("matching two members of the cycle still terminates and dedupes", () => {
    const out = run(`<AsAlpha /><AsGamma />`);
    expect(out).toEqual(new Set(["as-alpha-x", "as-beta-x", "as-gamma-x"]));
  });
});
