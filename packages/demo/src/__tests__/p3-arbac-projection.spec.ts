import { describe, it, expect } from "vite-plus/test";
import {
  narrowProjection,
  unionAllowedColumns,
} from "../server/auth/arbac-db.controller";

describe("p3 arbac narrowProjection (transformProjection helper)", () => {
  it("admin-ish empty-columns scope → projection is untouched", () => {
    expect(narrowProjection([{}], ["a", "b"])).toEqual(["a", "b"]);
    expect(narrowProjection([{}], undefined)).toBeUndefined();
  });

  it("scope columns → narrows undefined projection to whitelist", () => {
    expect(narrowProjection([{ columns: ["id", "name"] }], undefined)).toEqual([
      "id",
      "name",
    ]);
  });

  it("scope columns → intersects explicit array projection", () => {
    expect(
      narrowProjection([{ columns: ["id", "name"] }], ["id", "secret", "name"]),
    ).toEqual(["id", "name"]);
  });

  it("union across multiple scopes", () => {
    const out = narrowProjection(
      [{ columns: ["id", "name"] }, { columns: ["name", "email"] }],
      undefined,
    );
    expect(Array.isArray(out)).toBe(true);
    expect((out as string[]).slice().sort()).toEqual(["email", "id", "name"]);
  });

  it("any unrestricted scope → admin-ish (projection passes through)", () => {
    expect(narrowProjection([{ columns: ["id"] }, {}], ["id", "secret"])).toEqual([
      "id",
      "secret",
    ]);
  });

  it("object-form projection → drops keys outside the whitelist", () => {
    const result = narrowProjection(
      [{ columns: ["id", "name"] }],
      { id: 1, name: 1, secret: 1 },
    );
    expect(result).toEqual({ id: 1, name: 1 });
  });

  it("unionAllowedColumns helper behaves consistently", () => {
    expect(unionAllowedColumns([])).toBeUndefined();
    expect(unionAllowedColumns([{}])).toBeUndefined();
    expect(unionAllowedColumns([{ columns: ["a"] }, {}])).toBeUndefined();
    expect(unionAllowedColumns([{ columns: ["a"] }, { columns: ["b"] }])?.sort()).toEqual([
      "a",
      "b",
    ]);
  });
});
