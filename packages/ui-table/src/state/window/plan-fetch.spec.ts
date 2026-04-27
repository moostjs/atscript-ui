import { describe, it, expect } from "vitest";
import { planFetch } from "./plan-fetch";

const blockSize = 100;
const buffer = blockSize / 4;

function cacheRange(start: number, end: number) {
  const m = new Map<number, unknown>();
  for (let i = start; i < end; i++) m.set(i, { id: i });
  return m;
}

describe("planFetch", () => {
  it("returns null for an empty viewport", () => {
    expect(
      planFetch({
        top: 0,
        viewport: 0,
        totalCount: 1000,
        cache: new Map(),
        blockSize,
        buffer,
      }),
    ).toBeNull();
  });

  it("returns null when top is past totalCount", () => {
    expect(
      planFetch({
        top: 2000,
        viewport: 30,
        totalCount: 1000,
        cache: new Map(),
        blockSize,
        buffer,
      }),
    ).toBeNull();
  });

  it("fully cached viewport with healthy buffers → null", () => {
    const cache = cacheRange(0, 200);
    expect(
      planFetch({
        top: 50,
        viewport: 30,
        totalCount: 1000,
        cache,
        blockSize,
        buffer,
      }),
    ).toBeNull();
  });

  it("forward buffer at edge (one row short of threshold) → forward prefetch", () => {
    // viewport = [70, 100), end = 99. Buffer of `buffer - 1 = 24` cached rows
    // beyond end → forward prefetch fires.
    const cache = cacheRange(0, 100 + (buffer - 1));
    const plan = planFetch({
      top: 70,
      viewport: 30,
      totalCount: 1000,
      cache,
      blockSize,
      buffer,
    });
    expect(plan).toEqual({
      skip: 100 + (buffer - 1),
      limit: blockSize,
      mode: "steady",
    });
  });

  it("forward buffer exactly at threshold → null", () => {
    // Exactly `buffer` cached rows beyond end → no fetch (strict `<`).
    const cache = cacheRange(0, 100 + buffer);
    const plan = planFetch({
      top: 70,
      viewport: 30,
      totalCount: 1000,
      cache,
      blockSize,
      buffer,
    });
    expect(plan).toBeNull();
  });

  it("backward buffer short, forward healthy → backward prefetch", () => {
    // Cached run [200, 400). Viewport = [205, 235). Backward buffer = 5 (200..204),
    // forward buffer = 165 (235..399) — way above threshold. Backward fires.
    const cache = cacheRange(200, 400);
    const plan = planFetch({
      top: 205,
      viewport: 30,
      totalCount: 1000,
      cache,
      blockSize,
      buffer,
    });
    // backwardEdge = 205 - 5 = 200; skip = max(0, 200 - 100) = 100; limit = 200 - 100 = 100.
    expect(plan).toEqual({ skip: 100, limit: 100, mode: "steady" });
  });

  it("forward + backward both short → forward wins", () => {
    // Cached [195, 215). Viewport = [200, 210). Both buffers tiny.
    const cache = cacheRange(195, 215);
    const plan = planFetch({
      top: 200,
      viewport: 10,
      totalCount: 1000,
      cache,
      blockSize,
      buffer,
    });
    // forwardEdge = 209 + 1 + 5 = 215; mode steady forward.
    expect(plan?.mode).toBe("steady");
    expect(plan?.skip).toBe(215);
    expect(plan?.limit).toBe(blockSize);
  });

  it("partial viewport (forward edge ran out mid-viewport) → steady forward block at gap", () => {
    // Cached [0, 80). Viewport = [70, 100). Top is cached, fwdCachedInView=10 (rows 70..79).
    // Gap starts at row 80 → fetch one block from 80.
    const cache = cacheRange(0, 80);
    const plan = planFetch({
      top: 70,
      viewport: 30,
      totalCount: 1000,
      cache,
      blockSize,
      buffer,
    });
    expect(plan).toEqual({ skip: 80, limit: blockSize, mode: "steady" });
  });

  it("empty cache + scroll-to-middle → jump with symmetric blockSize/2 lookBack + lookAhead", () => {
    const plan = planFetch({
      top: 5000,
      viewport: 30,
      totalCount: 1_000_000,
      cache: new Map(),
      blockSize,
      buffer,
    });
    // lookBack = lookAhead = 50. skip = 4950, limit = 30 + 50 + 50 = 130.
    expect(plan).toEqual({ skip: 4950, limit: 130, mode: "jump" });
  });

  it("jump near top=0 → lookBack clamped to 0", () => {
    const plan = planFetch({
      top: 10,
      viewport: 30,
      totalCount: 1_000_000,
      cache: new Map(),
      blockSize,
      buffer,
    });
    // lookBack = min(50, 10) = 10. skip = 0, limit = 30 + 10 + 50 = 90.
    expect(plan).toEqual({ skip: 0, limit: 90, mode: "jump" });
  });

  it("jump near totalCount → limit clamped to remaining rows", () => {
    const plan = planFetch({
      top: 950,
      viewport: 30,
      totalCount: 1000,
      cache: new Map(),
      blockSize,
      buffer,
    });
    // skip = 900, wantedLimit = 130, but totalCount - skip = 100 → limit = 100.
    expect(plan).toEqual({ skip: 900, limit: 100, mode: "jump" });
  });

  it("forward prefetch suppressed when viewport already touches dataset end", () => {
    // totalCount = 100. Cached [0, 100). Viewport [70, 100). forwardEdge = 100,
    // not < totalCount → forward branch skipped. Backward buffer = 70 (above
    // threshold). → null.
    const cache = cacheRange(0, 100);
    const plan = planFetch({
      top: 70,
      viewport: 30,
      totalCount: 100,
      cache,
      blockSize,
      buffer,
    });
    expect(plan).toBeNull();
  });

  it("backward prefetch suppressed at top=0", () => {
    // Cached [0, 200). Viewport [0, 30). Backward buffer = 0 BUT start = 0 → no backward fetch.
    // Forward buffer = 170 → no forward fetch. → null.
    const cache = cacheRange(0, 200);
    const plan = planFetch({
      top: 0,
      viewport: 30,
      totalCount: 1000,
      cache,
      blockSize,
      buffer,
    });
    expect(plan).toBeNull();
  });

  it("viewport top uncached but row before is cached → not a jump (continuity)", () => {
    // Cached [0, 100). Viewport [100, 130). cache.has(100)=false, cache.has(99)=true →
    // NOT jump; falls through to steady-forward-edge-ran-out.
    const cache = cacheRange(0, 100);
    const plan = planFetch({
      top: 100,
      viewport: 30,
      totalCount: 1000,
      cache,
      blockSize,
      buffer,
    });
    // fwdCachedInView = 0 (row 100 not cached). skip = 100, limit = blockSize.
    expect(plan).toEqual({ skip: 100, limit: blockSize, mode: "steady" });
  });

  it("viewport clamps to totalCount when computing end", () => {
    // totalCount = 110. Cached [0, 110). Viewport top=100, viewport=30 — but only 10
    // rows actually exist. end should clamp to 109. Forward buffer = 0, but
    // forwardEdge = 110 = totalCount → no forward fetch. Backward buffer = 100
    // (above threshold) → null.
    const cache = cacheRange(0, 110);
    const plan = planFetch({
      top: 100,
      viewport: 30,
      totalCount: 110,
      cache,
      blockSize,
      buffer,
    });
    expect(plan).toBeNull();
  });
});
