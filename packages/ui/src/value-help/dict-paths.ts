import type { ValueHelpInfo } from "./types";

export function valueHelpDictPaths(info: ValueHelpInfo): Set<string> {
  return new Set(
    [...info.primaryKeys, info.labelField, info.descrField, ...info.attrFields].filter(
      Boolean,
    ) as string[],
  );
}
