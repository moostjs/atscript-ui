import { describe, expect, it } from "vitest";
import {
  DRAFT_PERSISTED_ASPECTS,
  type PresetDraft,
  deserializeDraft,
  draftMatchesPreset,
  isEmptyDraft,
  serializeDraft,
} from "./preset-draft";
import type { PresetAspect } from "./preset-aspects";
import type { PresetSnapshot } from "./preset-types";

const ALL_ASPECTS: PresetAspect[] = ["columns", "filters", "filterOps", "sorters", "itemsPerPage"];

describe("DRAFT_PERSISTED_ASPECTS", () => {
  it("excludes filterOps", () => {
    expect(DRAFT_PERSISTED_ASPECTS).toEqual(["columns", "filters", "sorters", "itemsPerPage"]);
  });
});

describe("serializeDraft", () => {
  it("captures all persisted aspects when available", () => {
    const snapshot: PresetSnapshot = {
      columns: { columnNames: ["a", "b"] },
      filters: ["status"],
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
      sorters: [{ field: "createdAt", direction: "desc" }],
      itemsPerPage: 25,
    };
    const draft = serializeDraft(snapshot, ALL_ASPECTS);
    expect(draft).toEqual({
      columns: { columnNames: ["a", "b"] },
      filters: ["status"],
      sorters: [{ field: "createdAt", direction: "desc" }],
      itemsPerPage: 25,
    });
    // filterOps is intentionally absent
    expect("filterOps" in draft).toBe(false);
  });

  it("never persists filterOps even if requested", () => {
    const snapshot: PresetSnapshot = {
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
    };
    const draft = serializeDraft(snapshot, ALL_ASPECTS);
    expect(draft).toEqual({});
  });

  it("gates itemsPerPage on availableAspects", () => {
    const snapshot: PresetSnapshot = { itemsPerPage: 50 };
    expect(serializeDraft(snapshot, ["columns", "filters", "sorters"])).toEqual({});
    expect(serializeDraft(snapshot, ["itemsPerPage"])).toEqual({ itemsPerPage: 50 });
  });

  it("skips aspects not in availableAspects", () => {
    const snapshot: PresetSnapshot = {
      columns: { columnNames: ["x"] },
      sorters: [{ field: "x", direction: "asc" }],
    };
    expect(serializeDraft(snapshot, ["columns"])).toEqual({
      columns: { columnNames: ["x"] },
    });
  });
});

describe("deserializeDraft", () => {
  it("round-trips a full draft", () => {
    const draft: PresetDraft = {
      columns: { columnNames: ["a", "b"], columnWidths: { a: "120px" } },
      filters: ["status"],
      sorters: [{ field: "name", direction: "asc" }],
      itemsPerPage: 25,
    };
    const out = deserializeDraft(draft, ALL_ASPECTS);
    expect(out).toEqual(draft);
  });

  it("silently skips aspects that left availableAspects (forward-compat)", () => {
    const draft: PresetDraft = {
      columns: { columnNames: ["a"] },
      itemsPerPage: 100,
    };
    const out = deserializeDraft(draft, ["columns"]);
    expect(out).toEqual({ columns: { columnNames: ["a"] } });
  });
});

describe("isEmptyDraft", () => {
  it("returns true for empty draft", () => {
    expect(isEmptyDraft({})).toBe(true);
  });

  it("returns false when any persisted aspect is set", () => {
    expect(isEmptyDraft({ columns: { columnNames: [] } })).toBe(false);
    expect(isEmptyDraft({ filters: [] })).toBe(false);
    expect(isEmptyDraft({ sorters: [] })).toBe(false);
    expect(isEmptyDraft({ itemsPerPage: 0 })).toBe(false);
  });
});

describe("draftMatchesPreset", () => {
  it("true when draft equals preset's persisted-aspects subset", () => {
    const preset: PresetSnapshot = {
      columns: { columnNames: ["a", "b"] },
      filters: ["status"],
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
      sorters: [{ field: "createdAt", direction: "desc" }],
      itemsPerPage: 25,
    };
    const draft: PresetDraft = {
      columns: { columnNames: ["a", "b"] },
      filters: ["status"],
      sorters: [{ field: "createdAt", direction: "desc" }],
      itemsPerPage: 25,
    };
    expect(draftMatchesPreset(draft, preset, ALL_ASPECTS)).toBe(true);
  });

  it("false when columns differ", () => {
    const preset: PresetSnapshot = { columns: { columnNames: ["a", "b"] } };
    const draft: PresetDraft = { columns: { columnNames: ["a", "b", "c"] } };
    expect(draftMatchesPreset(draft, preset, ALL_ASPECTS)).toBe(false);
  });

  it("ignores filterOps differences (filterOps not persisted in drafts)", () => {
    const preset: PresetSnapshot = {
      columns: { columnNames: ["a"] },
      filterOps: { status: [{ type: "eq", value: ["active"] }] },
    };
    const draft: PresetDraft = { columns: { columnNames: ["a"] } };
    expect(draftMatchesPreset(draft, preset, ALL_ASPECTS)).toBe(true);
  });

  it("treats key-order differences as equal (stable stringify)", () => {
    const preset: PresetSnapshot = {
      columns: { columnNames: ["a"], columnWidths: { b: "10px", a: "5px" } },
    };
    const draft: PresetDraft = {
      columns: { columnNames: ["a"], columnWidths: { a: "5px", b: "10px" } },
    };
    expect(draftMatchesPreset(draft, preset, ALL_ASPECTS)).toBe(true);
  });
});
