import { strongText } from "../common/_shared";

export { strongText };

export const dialogOverlay = "fixed inset-0 bg-black/30 z-[100]";

// Mobile-first: edge-to-edge full-screen (no rounded corners / shadow / border).
// At `sm` and above: centered, with chrome restored. Consumers add explicit
// width / height utilities behind `sm:` so the desktop size is stable; the
// mobile path uses the default `inset-0 size-full`.
export const dialogBase =
  "layer-0 fixed z-[101] flex flex-col outline-none " +
  "inset-0 size-full " +
  "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 " +
  "sm:rounded-r3 sm:shadow-popup sm:border-1";

export const smallInputBase =
  "scope-primary flex-1 h-fingertip-s px-$s min-w-[8em] outline-none " +
  "border-1 layer-0 rounded-base current-outline-hl " +
  `${strongText} placeholder:text-current/50`;

export const chipBase =
  "inline-flex items-center px-$s py-[0.15em] rounded-r0 text-callout whitespace-nowrap";

export const searchWrap = "relative flex-1 min-w-0 flex items-stretch";

export const searchIcon =
  "absolute left-$s top-1/2 -translate-y-1/2 text-current/50 pointer-events-none inline-flex text-body";

export const menuItemIconHl = "[&_.as-column-menu-item-icon]:text-current-hl";

/**
 * Build the `as-{prefix}-intent-*` shortcut variants used by `<AsRowActions>`
 * and `<AsTableActions>`. Both render a base button + dropdown-menu items;
 * intent affects them identically — only the class prefix differs. Returns
 * the map keys ready to spread into `defineShortcuts({ ... })`.
 *
 * Filled-button branch (`[&.{prefix}-btn]:`) only retunes scope; `c8-filled`
 * derives the contrasting foreground (NEVER override text color or the
 * contrast vanishes — red text on red bg). Menu-item branch is neutral at
 * rest, scope-tinted only on hover/highlighted; only the icon picks up
 * `text-current-hl`. `:is([data-highlighted=''])` wraps the attribute
 * selector to keep nested `[]` parseable inside arbitrary-variant brackets
 * (CLAUDE.md documents the silent-fail issue with raw nested brackets).
 *
 * `intent: "warning"` is forward-compat — pending the field landing in
 * `TDbActionIntent` in `@atscript/db`. Wired now so the moment db-client
 * ships it, controllers can opt in without UI changes.
 */
export function buildActionsIntentVariants(prefix: string): Record<string, string | Record<string, string>> {
  const btn = `[&.${prefix}-btn]:`;
  const item = `.${prefix}-menu-item`;
  const itemIcon = `${item}-icon`;

  function tinted(scope: string) {
    return {
      [btn]: `!scope-${scope}`,
      [`[&${item}]:hover:`]: `!scope-${scope} !bg-current-hl/10`,
      [`[&${item}]:data-[highlighted]:`]: `!scope-${scope} !bg-current-hl/10`,
      [`[&${item}:hover_${itemIcon}]:`]: "!text-current-hl",
      [`[&${item}:is([data-highlighted=''])_${itemIcon}]:`]: "!text-current-hl",
    };
  }

  return {
    [`${prefix}-intent-positive`]: tinted("good"),
    [`${prefix}-intent-negative`]: tinted("error"),
    [`${prefix}-intent-warning`]: tinted("warn"),
    [`${prefix}-intent-primary`]: "scope-primary",
    [`${prefix}-intent-secondary`]: "scope-secondary",
  };
}
