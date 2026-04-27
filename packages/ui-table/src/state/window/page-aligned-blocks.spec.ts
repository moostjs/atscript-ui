import { describe, it, expect } from "vitest";
import { pageAlignedBlocksFor } from "./page-aligned-blocks";

describe("pageAlignedBlocksFor", () => {
  it("returns one block for a request that fits in a single page", () => {
    expect(pageAlignedBlocksFor(0, 50, 100)).toEqual([{ page: 1, firstIndex: 0 }]);
  });

  it("returns multiple blocks when range crosses page boundaries", () => {
    const blocks = pageAlignedBlocksFor(50, 200, 100);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.page).toBe(1);
    expect(blocks[0]?.firstIndex).toBe(0);
    expect(blocks[1]?.page).toBe(2);
    expect(blocks[1]?.firstIndex).toBe(100);
    expect(blocks[2]?.page).toBe(3);
    expect(blocks[2]?.firstIndex).toBe(200);
  });

  it("partial first block — request starts mid-page still aligns to page boundary", () => {
    const blocks = pageAlignedBlocksFor(75, 25, 100);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.page).toBe(1);
    expect(blocks[0]?.firstIndex).toBe(0);
  });

  it("partial last block — request ends mid-page still pulls full block", () => {
    const blocks = pageAlignedBlocksFor(0, 150, 100);
    expect(blocks).toHaveLength(2);
    expect(blocks[1]?.firstIndex).toBe(100);
  });

  it("empty range returns no blocks", () => {
    expect(pageAlignedBlocksFor(0, 0, 100)).toEqual([]);
  });

  it("negative limit returns no blocks", () => {
    expect(pageAlignedBlocksFor(0, -1, 100)).toEqual([]);
  });

  it("zero blockSize returns no blocks (avoids div-by-zero)", () => {
    expect(pageAlignedBlocksFor(0, 100, 0)).toEqual([]);
  });

  it("blockSize=1 produces one block per row", () => {
    const blocks = pageAlignedBlocksFor(0, 5, 1);
    expect(blocks).toHaveLength(5);
    expect(blocks.map((b) => b.firstIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(blocks.map((b) => b.page)).toEqual([1, 2, 3, 4, 5]);
  });

  it("request starting at a far offset uses the right page numbers", () => {
    const blocks = pageAlignedBlocksFor(500, 50, 100);
    expect(blocks).toEqual([{ page: 6, firstIndex: 500 }]);
  });
});
