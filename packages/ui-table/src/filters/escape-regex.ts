import { escapeRegex } from "@atscript/ui";

export { escapeRegex };

/** Reverse of {@link escapeRegex}. */
export function unescapeRegex(input: string): string {
  return input.replace(/\\([.*+?^${}()|[\]\\])/g, "$1");
}
