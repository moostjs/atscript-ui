import { describe, it, expect } from "vitest";
import { displayColumnToDef, mergeDisplayColumns } from "../display-columns";
import { mockColumn } from "../../__tests__/helpers";

const col = (path: string, order: number) => mockColumn(path, { order });

describe("displayColumnToDef", () => {
  it("marks the column client-owned and non-filterable", () => {
    const def = displayColumnToDef({ key: "score", label: "Score" });
    expect(def).toMatchObject({
      path: "score",
      label: "Score",
      type: "text",
      local: true,
      sortable: false,
      filterable: false,
    });
  });

  it("enables sorting only for sortable: 'local'", () => {
    const def = displayColumnToDef({ key: "score", label: "Score", sortable: "local" });
    expect(def.sortable).toBe(true);
    expect(def.local).toBe(true);
  });

  it("carries width, type and component through", () => {
    const def = displayColumnToDef({
      key: "chart",
      label: "Chart",
      width: "8em",
      type: "number",
      component: "spark",
    });
    expect(def).toMatchObject({ width: "8em", type: "number", component: "spark" });
  });
});

describe("mergeDisplayColumns", () => {
  it("returns the base array untouched when there is nothing to merge", () => {
    const base = [col("a", 0)];
    expect(mergeDisplayColumns(base, [])).toBe(base);
  });

  it("appends columns without an explicit order", () => {
    const merged = mergeDisplayColumns(
      [col("a", 0), col("b", 1)],
      [{ key: "extra", label: "Extra" }],
    );
    expect(merged.map((c) => c.path)).toEqual(["a", "b", "extra"]);
  });

  it("places an ordered display column among the server columns", () => {
    const merged = mergeDisplayColumns(
      [col("a", 0), col("b", 2)],
      [{ key: "extra", label: "Extra", order: 1 }],
    );
    expect(merged.map((c) => c.path)).toEqual(["a", "extra", "b"]);
  });
});
