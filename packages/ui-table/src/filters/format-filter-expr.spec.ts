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

  it("words a relational predicate, its operand in the related table's paths", () => {
    const labels: Record<string, string> = { ticket: "Ticket", status: "Status" };
    expect(
      formatFilterExpr(
        { title: "x", ticket: { $some: { status: "open", teamId: { $in: ["t1", "t2"] } } } },
        (p) => labels[p],
      ),
    ).toBe("title equals x and Ticket has some (status equals open and teamId is one of t1, t2)");
    expect(formatFilterExpr({ issues: { $none: {} } })).toBe("issues has none (any)");
    expect(formatFilterExpr({ $not: { ticket: { $some: { status: "open" } } } })).toBe(
      "not (ticket has some (status equals open))",
    );
  });

  it("falls back to the URL spelling for an operator it cannot word", () => {
    expect(formatFilterExpr({ a: { $weird: 1 } } as never)).toBe("a$weird1");
  });

  it("a value formatter does not touch the decoder's output", () => {
    const expr = { total: { $gt: 5 } };
    const seen: unknown[] = [];
    const text = formatFilterExpr(expr, undefined, (_path, v) => {
      seen.push(v);
      return `<${String(v)}>`;
    });
    expect(text).toBe("total greater than <5>");
    expect(seen).toEqual([5]);
    // the same expression words the same way again (no state kept between calls)
    expect(formatFilterExpr(expr)).toBe("total greater than 5");
  });
});
