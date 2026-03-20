import { describe, it, expect } from "vitest";
import { mergeSorters } from "./merge-sorters";
import type { SortControl } from "@atscript/ui-core";

const asc = (field: string): SortControl => ({ field, direction: "asc" });
const desc = (field: string): SortControl => ({ field, direction: "desc" });

describe("mergeSorters", () => {
  it("returns user sorters when force is empty", () => {
    const user = [asc("name"), desc("age")];
    expect(mergeSorters([], user)).toEqual(user);
  });

  it("returns force sorters when user is empty", () => {
    const force = [asc("id")];
    expect(mergeSorters(force, [])).toEqual(force);
  });

  it("returns empty when both are empty", () => {
    expect(mergeSorters([], [])).toEqual([]);
  });

  it("places force sorters before user sorters", () => {
    const result = mergeSorters([asc("id")], [asc("name")]);
    expect(result).toEqual([asc("id"), asc("name")]);
  });

  it("deduplicates by field — force wins", () => {
    const result = mergeSorters([asc("name")], [desc("name"), asc("age")]);
    expect(result).toEqual([asc("name"), asc("age")]);
  });

  it("preserves order within each group", () => {
    const force = [desc("a"), asc("b")];
    const user = [asc("c"), desc("d"), asc("a")];
    expect(mergeSorters(force, user)).toEqual([desc("a"), asc("b"), asc("c"), desc("d")]);
  });

  it("does not mutate input arrays", () => {
    const force = [asc("id")];
    const user = [desc("id"), asc("name")];
    const forceCopy = [...force];
    const userCopy = [...user];
    mergeSorters(force, user);
    expect(force).toEqual(forceCopy);
    expect(user).toEqual(userCopy);
  });
});
