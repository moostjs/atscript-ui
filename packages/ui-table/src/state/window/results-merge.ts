type Row = Record<string, unknown>;

export interface MergeResult {
  newResults: Row[];
  newResultsStart: number;
}

export function walkForwardAbsorb(
  results: Row[],
  resultsStart: number,
  cache: Map<number, Row>,
): MergeResult {
  let idx = resultsStart + results.length;
  const tail: Row[] = [];
  while (cache.has(idx)) {
    const row = cache.get(idx);
    if (row === undefined) break;
    tail.push(row);
    idx++;
  }
  if (tail.length === 0) return { newResults: results, newResultsStart: resultsStart };
  return { newResults: [...results, ...tail], newResultsStart: resultsStart };
}

export function walkBackwardAbsorb(
  results: Row[],
  resultsStart: number,
  cache: Map<number, Row>,
): MergeResult {
  let idx = resultsStart - 1;
  const headReversed: Row[] = [];
  while (cache.has(idx)) {
    const row = cache.get(idx);
    if (row === undefined) break;
    headReversed.push(row);
    idx--;
  }
  if (headReversed.length === 0) return { newResults: results, newResultsStart: resultsStart };
  headReversed.reverse();
  return {
    newResults: [...headReversed, ...results],
    newResultsStart: resultsStart - headReversed.length,
  };
}
