import { translateQueryTree } from "@atscript/db";
import { describe, expect, it } from "vitest";
import { valueHelpFilter } from "./filter-tree";

const field = (name: string) => ({ field: name });

describe("valueHelpFilter", () => {
  const trees = {
    eq: { left: field("a"), op: "$eq", right: "x" },
    and: {
      $and: [
        { left: field("a"), op: "$eq", right: "x" },
        { left: field("b"), op: "$gt", right: 3 },
      ],
    },
    or: {
      $or: [
        { left: field("a"), op: "$eq", right: "x" },
        { left: field("b"), op: "$in", right: [1, 2] },
      ],
    },
    not: { $not: { left: field("a"), op: "$ne", right: null } },
    exists: { left: field("a"), op: "$exists", right: false },
    nested: {
      $and: [
        { $or: [{ left: field("a"), op: "$eq", right: "x" }] },
        { left: field("c"), op: "$regex", right: "/^a/i" },
      ],
    },
  };

  for (const [name, tree] of Object.entries(trees)) {
    it(`matches translateQueryTree (parity): ${name}`, () => {
      expect(valueHelpFilter(tree).filter).toEqual(
        translateQueryTree(tree as never, (r) => r.field),
      );
    });
  }

  it("pins only top-level `=` against a value", () => {
    expect(valueHelpFilter(trees.eq).pinned).toEqual(["a"]);
    expect(valueHelpFilter(trees.and).pinned).toEqual(["a"]);
    expect(valueHelpFilter(trees.or).pinned).toEqual([]);
    expect(valueHelpFilter(trees.not).pinned).toEqual([]);
    expect(valueHelpFilter(trees.nested).pinned).toEqual([]);
  });

  // Since 0.1.190: `targetField = Host.field` is a host reference, read from the form.
  it("lifts the host references out of the filter; the literal comparisons stay", () => {
    const tree = {
      $and: [
        { left: field("country"), op: "$eq", right: { type: () => ({}), field: "country" } },
        {
          $and: [
            { left: field("active"), op: "$eq", right: true },
            { left: field("region"), op: "$eq", right: field("area") },
          ],
        },
      ],
    };
    expect(valueHelpFilter(tree)).toEqual({
      filter: { active: { $eq: true } },
      pinned: ["active"],
      hostFilter: [
        { target: "country", local: "country" },
        { target: "region", local: "area" },
      ],
    });
  });

  it("a filter of host references only leaves no filter", () => {
    const tree = { left: field("a"), op: "$eq", right: field("b") };
    const lifted = valueHelpFilter(tree);
    expect(lifted.filter).toBeUndefined();
    expect(lifted).toEqual({ pinned: [], hostFilter: [{ target: "a", local: "b" }] });
  });

  it("several literal conjuncts stay one flat `$and`", () => {
    const tree = {
      $and: [
        { $and: [{ left: field("a"), op: "$eq", right: 1 }] },
        { left: field("b"), op: "$gt", right: 2 },
        { left: field("c"), op: "$eq", right: field("d") },
      ],
    };
    expect(valueHelpFilter(tree).filter).toEqual({
      $and: [{ a: { $eq: 1 } }, { b: { $gt: 2 } }],
    });
  });

  it("qualified refs resolve to the plain field", () => {
    const tree = { left: { type: () => ({}), field: "a" }, op: "$eq", right: 1 };
    expect(valueHelpFilter(tree).filter).toEqual({ a: { $eq: 1 } });
  });
});
