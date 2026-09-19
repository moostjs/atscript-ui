export const inputBase = "scope-primary layer-0 i8-bare h-fingertip-m px-$s w-full box-border";

/**
 * The `data-dirty` left rail, shared by `as-default-field` and both
 * `as-collapsible-*` containers. A SUBTLE, restrained accent — a thin bar in
 * the primary scope highlight — so a glance shows what the user touched
 * without a loud full-field treatment. Consumers restyle the whole family by
 * re-defining the variant keys that compose this via `vunorShortcuts()`.
 *
 * Painted on a positioned `::before` (every host is already `relative`);
 * `bg-current-hl` reads the scope-500 highlight, sized in `em` so it tracks
 * the host's type scale, and spans the host's full vertical extent. The
 * scope itself is NOT baked in here: `as-default-field` puts `scope-primary`
 * on the root, while the collapsible containers must keep it on the `::before`
 * (a root scope there would cascade the accent into every descendant label —
 * exactly the "whole subtree looks modified" noise this hook must avoid).
 */
export const dirtyRail =
  'content-[""] absolute left-[-0.4em] top-0 bottom-0 w-[0.15em] rounded-full bg-current-hl';

/**
 * Title accent for a dirty collapsible heading. AsCollapsible paints
 * `data-dirty` on the root AND the heading (never on descendants), so the
 * section title picks this up while child field labels — which are not
 * descendants of the heading — stay untouched.
 */
export const dirtyTitle = "scope-primary text-current-hl";
