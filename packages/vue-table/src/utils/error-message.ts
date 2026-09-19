/**
 * Turn an unknown thrown value into copy a user can read. Anything that
 * isn't an `Error` with a non-empty message falls back to `fallback` —
 * `"[object Object]"` and empty bubbles never reach the surface.
 *
 * @since 0.1.133
 */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
