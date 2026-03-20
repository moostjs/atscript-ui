import { describe, expect, it } from "vitest";
import { dateShortcuts } from "./date-shortcuts";

describe("dateShortcuts", () => {
  // Use a fixed date for deterministic tests: 2024-03-15
  const now = new Date(2024, 2, 15); // March 15, 2024

  it("returns 7 shortcuts", () => {
    const shortcuts = dateShortcuts(now);
    expect(shortcuts).toHaveLength(7);
  });

  it("Last 7 Days", () => {
    const shortcuts = dateShortcuts(now);
    const s = shortcuts.find((s) => s.label === "Last 7 Days")!;
    expect(s.dates[0]).toBe("2024-03-08");
    expect(s.dates[1]).toBe("2024-03-15");
  });

  it("Last 30 Days", () => {
    const shortcuts = dateShortcuts(now);
    const s = shortcuts.find((s) => s.label === "Last 30 Days")!;
    expect(s.dates[0]).toBe("2024-02-14");
    expect(s.dates[1]).toBe("2024-03-15");
  });

  it("Month to Date", () => {
    const shortcuts = dateShortcuts(now);
    const s = shortcuts.find((s) => s.label === "Month to Date")!;
    expect(s.dates[0]).toBe("2024-03-01");
    expect(s.dates[1]).toBe("2024-03-15");
  });

  it("Last 90 Days", () => {
    const shortcuts = dateShortcuts(now);
    const s = shortcuts.find((s) => s.label === "Last 90 Days")!;
    expect(s.dates[0]).toBe("2023-12-16");
    expect(s.dates[1]).toBe("2024-03-15");
  });

  it("Last 6 Months", () => {
    const shortcuts = dateShortcuts(now);
    const s = shortcuts.find((s) => s.label === "Last 6 Months")!;
    expect(s.dates[0]).toBe("2023-09-15");
    expect(s.dates[1]).toBe("2024-03-15");
  });

  it("Last 12 Months", () => {
    const shortcuts = dateShortcuts(now);
    const s = shortcuts.find((s) => s.label === "Last 12 Months")!;
    expect(s.dates[0]).toBe("2023-03-15");
    expect(s.dates[1]).toBe("2024-03-15");
  });

  it("Year to Date", () => {
    const shortcuts = dateShortcuts(now);
    const s = shortcuts.find((s) => s.label === "Year to Date")!;
    expect(s.dates[0]).toBe("2024-01-01");
    expect(s.dates[1]).toBe("2024-03-15");
  });

  it("all dates are ISO YYYY-MM-DD format", () => {
    const shortcuts = dateShortcuts(now);
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    for (const s of shortcuts) {
      expect(s.dates[0]).toMatch(isoPattern);
      expect(s.dates[1]).toMatch(isoPattern);
    }
  });

  it("end date is always the reference date", () => {
    const shortcuts = dateShortcuts(now);
    for (const s of shortcuts) {
      expect(s.dates[1]).toBe("2024-03-15");
    }
  });

  it("defaults to current date when no argument passed", () => {
    const shortcuts = dateShortcuts();
    const todayISO = new Date().toISOString().slice(0, 10);
    for (const s of shortcuts) {
      expect(s.dates[1]).toBe(todayISO);
    }
  });
});
