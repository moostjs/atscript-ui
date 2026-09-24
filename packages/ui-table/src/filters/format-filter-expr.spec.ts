import { describe, expect, it } from "vitest";
import { formatFilterExpr } from "./format-filter-expr";

describe("formatFilterExpr", () => {
  it("words a correlated $or with column labels", () => {
    const labels: Record<string, string> = { status: "Status", total: "Total" };
    const text = formatFilterExpr(
      {
        $or: [
          { status: "shipped", total: { $gt: 500 } },
          { status: "pending", total: { $lte: 50 } },
        ],
      },
      (p) => labels[p],
    );
    expect(text).toBe(
      "(Status equals shipped and Total greater than 500) or (Status equals pending and Total less or equal 50)",
    );
  });

  it("parenthesizes an or inside an and, and negations", () => {
    expect(formatFilterExpr({ a: 1, $or: [{ b: 2 }, { c: 3 }] })).toBe(
      "a equals 1 and (b equals 2 or c equals 3)",
    );
    expect(formatFilterExpr({ $not: { a: 1, b: { $ne: 2 } } })).toBe(
      "not (a equals 1 and b not equals 2)",
    );
  });

  it("words emptiness, lists and regex shortcuts like the filter chips", () => {
    expect(formatFilterExpr({ a: null })).toBe("a: empty");
    expect(formatFilterExpr({ a: { $exists: true } })).toBe("a: not empty");
    expect(formatFilterExpr({ a: { $in: [1, 2] } })).toBe("a is one of 1, 2");
    expect(formatFilterExpr({ a: { $nin: ["x"] } })).toBe("a is none of x");
    expect(formatFilterExpr({ a: { $regex: "/^ab/i" } })).toBe("a starts with ab");
  });

  it("falls back to the URL spelling for an operator it cannot word", () => {
    expect(formatFilterExpr({ a: { $weird: 1 } } as never)).toBe("a$weird1");
  });
});
