import { describe, it, expect } from "vitest";
import { reorderColumnNames } from "./reorder-column-names";

describe("reorderColumnNames", () => {
  it("moves a column to the right via 'after'", () => {
    expect(reorderColumnNames(["a", "b", "c", "d"], "a", "c", "after")).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("moves a column to the left via 'before'", () => {
    expect(reorderColumnNames(["a", "b", "c", "d"], "d", "b", "before")).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("returns input when fromPath === toPath", () => {
    const input = ["a", "b", "c"];
    const out = reorderColumnNames(input, "b", "b", "before");
    expect(out).toEqual(["a", "b", "c"]);
  });

  it("returns input when fromPath is missing", () => {
    expect(reorderColumnNames(["a", "b", "c"], "x", "b", "after")).toEqual(["a", "b", "c"]);
  });

  it("returns input when toPath is missing", () => {
    expect(reorderColumnNames(["a", "b", "c"], "a", "x", "before")).toEqual(["a", "b", "c"]);
  });

  it("drops 'before' the leftmost column to land at index 0", () => {
    expect(reorderColumnNames(["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"]);
  });

  it("drops 'after' the rightmost column to land at the last index", () => {
    expect(reorderColumnNames(["a", "b", "c"], "a", "c", "after")).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    reorderColumnNames(input, "a", "c", "after");
    expect(input).toEqual(["a", "b", "c"]);
  });

  it("is a no-op when neighbour-of-source resolves to the source's own slot ('after' the left neighbour)", () => {
    expect(reorderColumnNames(["a", "b", "c"], "b", "a", "after")).toEqual(["a", "b", "c"]);
  });

  it("is a no-op when neighbour-of-source resolves to the source's own slot ('before' the right neighbour)", () => {
    expect(reorderColumnNames(["a", "b", "c"], "b", "c", "before")).toEqual(["a", "b", "c"]);
  });

  it("symmetric move: from rightmost 'before' middle places source at middle index", () => {
    expect(reorderColumnNames(["a", "b", "c"], "c", "b", "before")).toEqual(["a", "c", "b"]);
  });

  it("symmetric move: from leftmost 'after' middle places source after middle", () => {
    expect(reorderColumnNames(["a", "b", "c"], "a", "b", "after")).toEqual(["b", "a", "c"]);
  });
});
