import { describe, expect, it, vi } from "vitest";
import { fetchDistinctValues, isPickerDeclined } from "./distinct-client";

function setup(rows: Record<string, unknown>[] = []) {
  const aggregate = vi.fn().mockResolvedValue(rows);
  const client = { aggregate } as never;
  return {
    aggregate,
    dv: { values: (field: string, opts?: object) => fetchDistinctValues(client, field, opts) },
  };
}

describe("fetchDistinctValues", () => {
  it("groups and selects the field, sorts only when sortable, asks for one extra row", async () => {
    const { aggregate, dv } = setup([{ city: "Berlin" }, { city: "Bonn" }]);
    const res = await dv.values("city", { limit: 1, sortable: true });
    expect(aggregate).toHaveBeenCalledWith({
      controls: { $groupBy: ["city"], $select: ["city"], $sort: { city: 1 }, $limit: 2, $skip: 0 },
    });
    expect(res).toEqual({ items: ["Berlin"], hasMore: true });
  });

  it("omits $sort on a manual-sort table", async () => {
    const { aggregate, dv } = setup([]);
    await dv.values("city", { sortable: false, skip: 100 });
    const controls = aggregate.mock.calls[0][0].controls;
    expect(controls).not.toHaveProperty("$sort");
    expect(controls.$skip).toBe(100);
  });

  it("drops the null group client-side", async () => {
    const { dv } = setup([{ city: null }, { city: "A" }]);
    expect((await dv.values("city")).items).toEqual(["A"]);
  });

  it("searches strings by case-insensitive escaped prefix", async () => {
    const { aggregate, dv } = setup();
    await dv.values("city", { text: "a.b" });
    expect(aggregate.mock.calls[0][0].filter).toEqual({ city: { $regex: "/^a\\.b/i" } });
  });

  it("searches numbers by equality; non-numeric text sends no request", async () => {
    const { aggregate, dv } = setup([{ n: 7 }]);
    await dv.values("n", { text: "7", numeric: true });
    expect(aggregate.mock.calls[0][0].filter).toEqual({ n: 7 });
    aggregate.mockClear();
    expect(await dv.values("n", { text: "x", numeric: true })).toEqual({
      items: [],
      hasMore: false,
    });
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("ANDs an extra scope with the search", async () => {
    const { aggregate, dv } = setup();
    await dv.values("city", { text: "b", filter: { active: true } as never });
    expect(aggregate.mock.calls[0][0].filter).toEqual({
      $and: [{ active: true }, { city: { $regex: "/^b/i" } }],
    });
  });

  it("flags 4xx answers as 'no help'", () => {
    expect(isPickerDeclined({ status: 400 })).toBe(true);
    expect(isPickerDeclined({ status: 403 })).toBe(true);
    expect(isPickerDeclined({ status: 500 })).toBe(false);
    expect(isPickerDeclined(new Error("network"))).toBe(false);
  });
});
