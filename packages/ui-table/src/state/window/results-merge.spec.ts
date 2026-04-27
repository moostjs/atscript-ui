import { describe, it, expect } from "vitest";
import { walkForwardAbsorb, walkBackwardAbsorb } from "./results-merge";

type Row = Record<string, unknown>;
const row = (id: number): Row => ({ id });
const rows = (start: number, count: number): Row[] =>
  Array.from({ length: count }, (_, i) => row(start + i));

describe("walkForwardAbsorb", () => {
  it("absorbs a previously-cached island that touches results.end", () => {
    const cache = new Map<number, Row>();
    for (let i = 100; i < 150; i++) cache.set(i, row(i));
    const result = walkForwardAbsorb(rows(0, 100), 0, cache);
    expect(result.newResults.length).toBe(150);
    expect((result.newResults[149] as Row).id).toBe(149);
  });

  it("no-op when no chained cached island", () => {
    const cache = new Map<number, Row>();
    const result = walkForwardAbsorb(rows(0, 50), 0, cache);
    expect(result.newResults).toHaveLength(50);
  });

  it("idempotent re-walk produces identical output", () => {
    const cache = new Map<number, Row>();
    for (let i = 50; i < 75; i++) cache.set(i, row(i));
    const first = walkForwardAbsorb(rows(0, 50), 0, cache);
    expect(first.newResults.length).toBe(75);
    // Re-walk: cache still has rows up to 74, but results now extends to 75.
    const second = walkForwardAbsorb(first.newResults, 0, cache);
    expect(second.newResults.length).toBe(75);
  });

  it("stops at the first gap", () => {
    const cache = new Map<number, Row>();
    cache.set(50, row(50));
    cache.set(51, row(51));
    cache.set(60, row(60));
    const result = walkForwardAbsorb(rows(0, 50), 0, cache);
    expect(result.newResults.length).toBe(52);
  });
});

describe("walkBackwardAbsorb", () => {
  it("absorbs a previously-cached island that touches resultsStart - 1", () => {
    const cache = new Map<number, Row>();
    for (let i = 50; i < 100; i++) cache.set(i, row(i));
    const result = walkBackwardAbsorb(rows(100, 50), 100, cache);
    expect(result.newResults.length).toBe(100);
    expect(result.newResultsStart).toBe(50);
    expect((result.newResults[0] as Row).id).toBe(50);
  });

  it("no-op when no chained cached island", () => {
    const cache = new Map<number, Row>();
    const result = walkBackwardAbsorb(rows(100, 50), 100, cache);
    expect(result.newResults).toHaveLength(50);
    expect(result.newResultsStart).toBe(100);
  });

  it("stops at the first gap", () => {
    const cache = new Map<number, Row>();
    cache.set(99, row(99));
    cache.set(98, row(98));
    cache.set(95, row(95));
    const result = walkBackwardAbsorb(rows(100, 50), 100, cache);
    expect(result.newResults.length).toBe(52);
    expect(result.newResultsStart).toBe(98);
  });
});
