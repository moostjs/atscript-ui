import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSystemPresets } from "./system-presets";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveSystemPresets", () => {
  it("materialises Standard with empty content when input is omitted", () => {
    const list = resolveSystemPresets();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ id: "sys:standard", label: "Standard", content: {} });
  });

  it("materialises Standard with empty content when input is empty array", () => {
    const list = resolveSystemPresets([]);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("sys:standard");
  });

  it("auto-prefixes bare ids", () => {
    const list = resolveSystemPresets([
      { id: "monitoring", label: "Monitoring view", content: { sorters: [] } },
    ]);
    expect(list).toHaveLength(2);
    expect(list[1].id).toBe("sys:monitoring");
    expect(list[1].label).toBe("Monitoring view");
  });

  it("renders Standard at index 0 followed by named presets in array order", () => {
    const list = resolveSystemPresets([
      { id: "audit", label: "Audit view", content: {} },
      { id: "monitoring", label: "Monitoring view", content: {} },
    ]);
    expect(list.map((p) => p.id)).toEqual(["sys:standard", "sys:audit", "sys:monitoring"]);
  });

  it("lets consumers override Standard via id 'standard'", () => {
    const list = resolveSystemPresets([
      {
        id: "standard",
        label: "Default columns",
        content: { columns: { columnNames: ["name", "sku"] } },
      },
      { id: "monitoring", label: "Monitoring view", content: {} },
    ]);
    expect(list[0]).toEqual({
      id: "sys:standard",
      label: "Default columns",
      content: { columns: { columnNames: ["name", "sku"] } },
    });
    expect(list[1].id).toBe("sys:monitoring");
  });

  it("lets consumers override Standard via fully-qualified id 'sys:standard'", () => {
    const list = resolveSystemPresets([{ id: "sys:standard", label: "Defaults", content: {} }]);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("Defaults");
  });

  it("drops duplicate ids with console.warn (first wins)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const list = resolveSystemPresets([
      { id: "monitoring", label: "First", content: {} },
      { id: "sys:monitoring", label: "Second", content: {} },
    ]);
    expect(list).toHaveLength(2); // standard + first monitoring
    expect(list[1].label).toBe("First");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("defaults missing content to empty snapshot", () => {
    const list = resolveSystemPresets([{ id: "audit", label: "Audit" }]);
    expect(list[1].content).toEqual({});
  });
});
