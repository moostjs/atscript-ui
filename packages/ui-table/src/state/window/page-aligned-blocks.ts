/**
 * Clamp a window's `topIndex` to the valid `[0, totalCount - viewport]` range.
 * `viewport` past `totalCount` (or zero/negative totals) collapses to `0`.
 */
export function clampTopIndex(topIndex: number, totalCount: number, viewport: number): number {
  const max = Math.max(0, totalCount - viewport);
  return Math.max(0, Math.min(max, topIndex));
}

/** Index of the first row in the block that contains `absIdx`. */
export function blockStartFor(absIdx: number, blockSize: number): number {
  return Math.floor(absIdx / blockSize) * blockSize;
}

export interface PageAlignedBlock {
  page: number;
  firstIndex: number;
}

export function pageAlignedBlocksFor(
  skip: number,
  limit: number,
  blockSize: number,
): PageAlignedBlock[] {
  if (limit <= 0 || blockSize <= 0) return [];
  const start = Math.max(0, skip);
  const end = start + limit;
  const firstBlock = Math.floor(start / blockSize);
  const lastBlock = Math.floor((end - 1) / blockSize);
  const blocks: PageAlignedBlock[] = [];
  for (let b = firstBlock; b <= lastBlock; b++) {
    blocks.push({ page: b + 1, firstIndex: b * blockSize });
  }
  return blocks;
}
