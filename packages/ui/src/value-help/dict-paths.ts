import type { ResolvedValueHelp } from "./resolve";

/**
 * Paths that make up the "dict view" of a value-help target:
 * PKs + label + descr + attr fields. Used by filter dialogs to clamp
 * visible columns to the dictionary subset.
 */
export function valueHelpDictPaths(resolved: ResolvedValueHelp): Set<string> {
  const paths: string[] = [...resolved.primaryKeys, resolved.labelField, ...resolved.attrFields];
  if (resolved.descrField) paths.push(resolved.descrField);
  return new Set(paths);
}
