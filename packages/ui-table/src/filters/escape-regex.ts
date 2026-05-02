/** Escape special regex characters in user input for safe embedding in $regex. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Reverse of {@link escapeRegex}. */
export function unescapeRegex(input: string): string {
  return input.replace(/\\([.*+?^${}()|[\]\\])/g, "$1");
}
