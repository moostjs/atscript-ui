import type { TDbActionInfo } from "@atscript/db-client";
import { describe, expect, it } from "vitest";
import { navigateHrefFor } from "./navigate-href";

// ── Helpers ──────────────────────────────────────────────────

function action(overrides: Partial<TDbActionInfo>): TDbActionInfo {
  return {
    name: "open",
    label: "Open",
    level: "row",
    processor: "navigate",
    value: "/orders/$1",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("navigateHrefFor", () => {
  it("returns undefined for non-navigate processors (buttons stay buttons)", () => {
    expect(navigateHrefFor(action({ processor: "backend" }), { id: "1" }, ["id"])).toBeUndefined();
    expect(navigateHrefFor(action({ processor: "custom" }), { id: "1" }, ["id"])).toBeUndefined();
  });

  it("returns the value verbatim for table-level navigate actions", () => {
    const a = action({ level: "table", value: "/reports/summary" });
    expect(navigateHrefFor(a, undefined, ["id"])).toBe("/reports/summary");
  });

  it("returns the value verbatim for rows-level navigate actions (no $1 interpolation)", () => {
    const a = action({ level: "rows", value: "/bulk/$1" });
    expect(navigateHrefFor(a, { id: "1" }, ["id"])).toBe("/bulk/$1");
  });

  it("substitutes $1 with the encoded id for row-level actions", () => {
    expect(navigateHrefFor(action({}), { id: "42" }, ["id"])).toBe("/orders/42");
  });

  it("replaces every $1 occurrence, not just the first", () => {
    const a = action({ value: "/orders/$1?highlight=$1" });
    expect(navigateHrefFor(a, { id: "42" }, ["id"])).toBe("/orders/42?highlight=42");
  });

  it("URL-encodes special characters in id values", () => {
    expect(navigateHrefFor(action({}), { id: "a/b c" }, ["id"])).toBe("/orders/a%2Fb%20c");
  });

  it("joins compound preferredId fields with a literal / in declaration order", () => {
    const id = { name: "jane", org: "acme" };
    expect(navigateHrefFor(action({}), id, ["org", "name"])).toBe("/orders/acme/jane");
  });

  it("returns undefined when the row is not identifiable (id undefined → button fallback)", () => {
    expect(navigateHrefFor(action({}), undefined, ["id"])).toBeUndefined();
  });

  it("returns undefined when preferredId is empty (nothing to encode → button fallback)", () => {
    expect(navigateHrefFor(action({}), { id: "42" }, [])).toBeUndefined();
  });
});
