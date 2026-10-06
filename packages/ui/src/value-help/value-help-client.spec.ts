import { describe, expect, it, vi } from "vitest";
import { ValueHelpClient } from "./value-help-client";
import type { ResolvedValueHelp } from "./resolve";

function resolved(over: Partial<ResolvedValueHelp> = {}): ResolvedValueHelp {
  return {
    url: "/attribute-values",
    primaryKeys: ["attribute", "value"],
    labelField: "label",
    descrField: undefined,
    attrFields: [],
    filterableFields: [],
    sortableFields: [],
    searchable: false,
    targetType: undefined as never,
    ...over,
  };
}

function setup() {
  const query = vi.fn().mockResolvedValue([]);
  return { query, vh: new ValueHelpClient({ query } as never) };
}

describe("ValueHelpClient.search", () => {
  it("sends the static filter alone when there is no search text", async () => {
    const { query, vh } = setup();
    const filter = { attribute: { $eq: "color" } };
    await vh.search(resolved(), { filter: filter as never });
    expect(query).toHaveBeenCalledWith({
      filter,
      controls: { $select: ["attribute", "value", "label"], $limit: 20 },
    });
  });

  it("ANDs the static filter with the non-searchable $or search, matching exactly on the value field", async () => {
    const { query, vh } = setup();
    const filter = { attribute: { $eq: "color" } };
    await vh.search(resolved(), { text: "bl", filter: filter as never, valueField: "value" });
    const arg = query.mock.calls[0][0];
    expect(arg.filter.$and[0]).toEqual(filter);
    const or = arg.filter.$and[1].$or;
    // regex over the select fields except the exact-match key …
    expect(or).toContainEqual({ attribute: { $regex: "/^bl/i" } });
    expect(or).toContainEqual({ label: { $regex: "/^bl/i" } });
    expect(or).not.toContainEqual({ value: { $regex: "/^bl/i" } });
    // … and an exact match on `value`, not on primaryKeys[0] (`attribute`)
    expect(or).toContainEqual({ value: "bl" });
    expect(or).not.toContainEqual({ attribute: "bl" });
  });

  it("selects the value field even when it is not a key or label (unique non-PK)", async () => {
    const { query, vh } = setup();
    await vh.search(resolved({ primaryKeys: ["id"], labelField: "name" }), { valueField: "code" });
    expect(query.mock.calls[0][0].controls.$select).toEqual(["id", "name", "code"]);
  });

  it("keeps $search server-side and AND-able with the static filter", async () => {
    const { query, vh } = setup();
    const filter = { attribute: { $eq: "color" } };
    await vh.search(resolved({ searchable: true }), { text: "bl", filter: filter as never });
    expect(query).toHaveBeenCalledWith({
      filter,
      controls: { $select: ["attribute", "value", "label"], $limit: 20, $search: "bl" },
    });
  });

  it("defaults the exact-match key to primaryKeys[0] (unchanged for single-key dictionaries)", async () => {
    const { query, vh } = setup();
    await vh.search(resolved({ primaryKeys: ["id"], labelField: "name" }), { text: "7" });
    expect(query.mock.calls[0][0].filter.$or).toContainEqual({ id: 7 });
  });
});
