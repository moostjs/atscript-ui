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
  "scope-primary layer-0 i8-bare flex-1 h-fingertip-s px-$s min-w-[8em]";

export const chipBase =
  "inline-flex items-center px-$s py-[0.15em] rounded-r0 text-callout whitespace-nowrap";

export const searchWrap = "relative flex-1 min-w-0 flex items-stretch";

export const searchIcon =
  "absolute left-$s top-1/2 -translate-y-1/2 text-current/50 pointer-events-none inline-flex text-body";

export const menuItemIconHl = "[&_.as-column-menu-item-icon]:text-current-hl";

// Cancel/confirm-button base recipes shared by `as-confirm-dialog-*` and
// `as-action-form-*`. Confirm chrome paints `c8-filled` (bg + contrasting
// fg derived by vunor) — never override text-color or the contrast disappears
// (red text on red bg). Intent variants come from `buildDialogConfirmVariants`.
export const dialogCancelBtn = "scope-neutral c8-chrome btn";
export const dialogConfirmBtn = "scope-primary c8-filled btn";

/**
 * Confirm-button intent variant block shared by `as-confirm-dialog-confirm-*`
 * and `as-action-form-submit-*`. The caller maps `action.intent → scope` via
 * `intentToScope` (runtime); this returns the matching CSS-side overrides.
 *
 * Only retunes scope; never overrides text color (`c8-filled` derives the
 * contrasting fg — red text on red bg if we touch it). `primary`/`secondary`
 * are bare scope tokens because the base shortcut already paints `c8-filled`
 * and they don't need the `!`-flagged override.
 */
export function buildDialogConfirmVariants(
  prefix: string,
): Record<string, string | Record<string, string>> {
  const base = `[&.${prefix}]:`;
  return {
    [`${prefix}-good`]: { [base]: "!scope-good" },
    [`${prefix}-error`]: { [base]: "!scope-error" },
    [`${prefix}-warn`]: { [base]: "!scope-warn" },
    [`${prefix}-primary`]: "scope-primary",
    [`${prefix}-secondary`]: "scope-secondary",
    [`${prefix}-neutral`]: { [base]: "!scope-neutral" },
  };
}

/**
 * The dropdown-menu item family shared by `<AsRowActions>` and
 * `<AsTableActions>` (`<AsActionMenuItem>` composes these against the
 * surface's prefix): `${prefix}-menu-item` + `-icon` / `-label` / `-reason`,
 * and `${prefix}-menu-separator`. Spread into `defineShortcuts({ ... })`.
 *
 * `decoration-none`: navigate items render as real anchors — kill the UA
 * underline (no-op on divs); `text-current` beats UA link/visited colors.
 * `[data-default]` items are bold so the level's default stands out.
 *
 * Disabled-with-reason items carry `aria-disabled="true"` (kept focusable so
 * the reason stays reachable): `disabled-soft` dims them; the neutral
 * hover / highlight stays as the keyboard focus indicator, and the intent tint
 * is withheld in {@link buildActionsIntentVariants}. The reason sits on its
 * own line under the label, wrapping (the menu is `whitespace-nowrap`) inside
 * a capped width so a long reason can't stretch the menu across the screen.
 */
export function buildActionMenuItemShortcuts(
  prefix: string,
): Record<string, string | Record<string, string>> {
  return {
    [`${prefix}-menu-item`]: {
      "": "flex items-center gap-$s w-full px-$m py-$xs border-0 bg-transparent text-current decoration-none text-left cursor-pointer outline-none disabled-soft",
      "hover:": "layer-3",
      "data-[highlighted]:": "layer-3",
      "[&[data-default]]:": "font-700",
    },
    [`${prefix}-menu-item-icon`]: "inline-flex text-[1.25em] text-current/60 shrink-0",
    [`${prefix}-menu-item-label`]: "flex-1 min-w-0 overflow-hidden text-ellipsis",
    [`${prefix}-menu-item-reason`]: "block max-w-[20em] whitespace-normal text-caption",
    [`${prefix}-menu-separator`]: "h-0 my-$xs border-t-1",
  };
}

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
 * `text-current-hl`. `:is(...)` / `:not(...)` wrap the attribute selectors to
 * keep nested `[]` parseable inside arbitrary-variant brackets (CLAUDE.md
 * documents the silent-fail issue with raw nested brackets).
 *
 * `intent: "warning"` is forward-compat — pending the field landing in
 * `TDbActionIntent` in `@atscript/db`. Wired now so the moment db-client
 * ships it, controllers can opt in without UI changes.
 */
export function buildActionsIntentVariants(
  prefix: string,
): Record<string, string | Record<string, string>> {
  const btn = `[&.${prefix}-btn]:`;
  const item = `.${prefix}-menu-item`;
  const itemIcon = `${item}-icon`;

  // A disabled item (`aria-disabled`, see `<AsActionMenuItem>`) never takes
  // the intent tint — hover / keyboard highlight fall back to the neutral base
  // highlight, which stays as the focus indicator. Hence `:not([aria-disabled])`
  // on every tinted selector (one bracket group per selector: UnoCSS drops a
  // variant with two).
  const enabledItem = `${item}:not([aria-disabled])`;
  function tinted(scope: string) {
    return {
      [btn]: `!scope-${scope}`,
      [`[&${enabledItem}]:hover:`]: `!scope-${scope} !bg-current-hl/10`,
      [`[&${enabledItem}]:data-[highlighted]:`]: `!scope-${scope} !bg-current-hl/10`,
      [`[&${enabledItem}:hover_${itemIcon}]:`]: "!text-current-hl",
      [`[&${item}:is([data-highlighted]:not([aria-disabled]))_${itemIcon}]:`]: "!text-current-hl",
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

/**
 * Inline mutation-failure text (preset save / save-as, staged preset writes).
 * `role="alert"` lives in the markup, so this is presentation only:
 * `min-w-0 break-words` keeps a long server message inside its flex row
 * instead of blowing the panel's width out.
 */
export const inlineErrorText = "scope-error text-current-hl text-caption min-w-0 break-words";

/**
 * Viewport-height cap for a Reka-positioned popper panel.
 * `--reka-popper-available-height` is the space Reka measured between the
 * trigger and the viewport edge; without the cap a long list (or a trigger
 * near the bottom of the screen) renders past the viewport with no way to
 * reach the rest of it.
 */
export const popperCap = "max-h-[var(--reka-popper-available-height)]";

/** {@link popperCap} for a panel that is ALL scrollable content. */
export const popperCapped = `${popperCap} overflow-y-auto`;

/**
 * {@link popperCap} for a panel with pinned chrome. The cap and the scroll
 * must sit in different boxes: weld them together and whatever the panel
 * pins — a footer, an error note — scrolls away with the content it was
 * meant to stay above. The scrolling child carries {@link panelBodyShrink}.
 */
export const popperCapShell = `${popperCap} flex flex-col overflow-hidden`;

/**
 * Scrolling middle region of a {@link popperCapShell}. `min-h-0` is
 * load-bearing: without it the box refuses to shrink below its content and
 * pushes its pinned siblings past the cap — which `overflow-hidden` then
 * clips away rather than letting anyone scroll to them.
 */
export const panelBodyShrink = "flex flex-col min-h-0 overflow-y-auto";
