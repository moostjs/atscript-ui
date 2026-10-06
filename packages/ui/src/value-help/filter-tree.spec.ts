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
    fieldToField: { left: field("a"), op: "$eq", right: field("b") },
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
    expect(valueHelpFilter(trees.fieldToField).pinned).toEqual([]);
    expect(valueHelpFilter(trees.nested).pinned).toEqual([]);
  });

  it("qualified refs resolve to the plain field", () => {
    const tree = { left: { type: () => ({}), field: "a" }, op: "$eq", right: 1 };
    expect(valueHelpFilter(tree).filter).toEqual({ a: { $eq: 1 } });
  });
});
