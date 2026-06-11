/**
 * Single runtime implementation of the companion-expansion walk.
 *
 * Given a set of starting component names, collects each component's own
 * classes plus the classes of every companion reachable through the
 * `componentCompanions` adjacency map (companions of companions included).
 *
 * Exclusion semantics: an excluded name is skipped entirely — its own
 * classes are NOT added and the walk does NOT continue through its
 * companions. Classes reachable only through an excluded component are
 * therefore dropped, while classes also reachable via a non-excluded path
 * are kept.
 *
 * The maps are passed in (rather than imported) so this module has no
 * dependency on the generated data file — the generated module delegates
 * here, and the extractor reuses the same walk.
 */
export function expandComponentClasses(
  names: readonly string[],
  componentClasses: Record<string, readonly string[]>,
  componentCompanions: Readonly<Partial<Record<string, readonly string[]>>>,
  exclude?: ReadonlySet<string>,
): Set<string> {
  const out = new Set<string>();
  const visited = new Set<string>();
  const stack = [...names];
  while (stack.length > 0) {
    const name = stack.pop() as string;
    if (visited.has(name) || (exclude !== undefined && exclude.has(name))) continue;
    visited.add(name);
    const classes = componentClasses[name];
    if (classes) for (const cls of classes) out.add(cls);
    const companions = componentCompanions[name];
    if (companions) for (const companion of companions) stack.push(companion);
  }
  return out;
}
