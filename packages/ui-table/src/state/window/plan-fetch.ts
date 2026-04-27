// `jump`   — viewport sits in uncached territory; fetch a slightly oversized
//            window centered on the viewport (call sites debounce these).
// `steady` — viewport is cached or partially cached; fetch one block at the
//            edge that's about to run out (call sites dispatch immediately).
export type FetchPlanMode = "jump" | "steady";

export interface FetchPlan {
  skip: number;
  limit: number;
  mode: FetchPlanMode;
}

export interface PlanFetchArgs {
  top: number;
  viewport: number;
  totalCount: number;
  cache: Map<number, unknown>;
  blockSize: number;
  /** Threshold below which a steady prefetch fires. Typically `blockSize / 4`. */
  buffer: number;
}

export function planFetch(args: PlanFetchArgs): FetchPlan | null {
  const { top, viewport, totalCount, cache, blockSize, buffer } = args;
  if (viewport <= 0) return null;
  if (top >= totalCount) return null;

  const start = top;
  const effectiveViewport = Math.min(viewport, totalCount - start);
  if (effectiveViewport <= 0) return null;
  const end = start + effectiveViewport - 1;

  // JUMP: viewport top has no continuity with cache.
  if (!cache.has(start) && !cache.has(start - 1)) {
    const half = Math.floor(blockSize / 2);
    const lookBack = Math.min(half, start);
    const lookAhead = half;
    const skip = Math.max(0, start - lookBack);
    const wantedLimit = effectiveViewport + lookBack + lookAhead;
    const limit = Math.min(totalCount - skip, wantedLimit);
    if (limit <= 0) return null;
    return { skip, limit, mode: "jump" };
  }

  let fwdCachedInView = 0;
  while (fwdCachedInView < effectiveViewport && cache.has(start + fwdCachedInView)) {
    fwdCachedInView++;
  }

  // STEADY (forward edge ran out): fetch from the gap.
  if (fwdCachedInView < effectiveViewport) {
    const skip = start + fwdCachedInView;
    if (skip >= totalCount) return null;
    return { skip, limit: blockSize, mode: "steady" };
  }

  let fwdBuffer = 0;
  while (cache.has(end + 1 + fwdBuffer)) fwdBuffer++;

  // STEADY (forward prefetch).
  const forwardEdge = end + 1 + fwdBuffer;
  if (fwdBuffer < buffer && forwardEdge < totalCount) {
    return { skip: forwardEdge, limit: blockSize, mode: "steady" };
  }

  let bwdBuffer = 0;
  while (start - 1 - bwdBuffer >= 0 && cache.has(start - 1 - bwdBuffer)) {
    bwdBuffer++;
  }

  // STEADY (backward prefetch).
  if (bwdBuffer < buffer && start > 0) {
    const backwardEdge = start - bwdBuffer;
    const skip = Math.max(0, backwardEdge - blockSize);
    const limit = backwardEdge - skip;
    if (limit <= 0) return null;
    return { skip, limit, mode: "steady" };
  }

  return null;
}
