import { defineShortcuts } from "vunor/theme";

/**
 * Object renderer chrome — alternates between collapsible "section" (a
 * divider + clickable summary, no own background) and "island" (a padded,
 * bordered card with alternating layer) as nesting deepens. Both variants
 * use native `<details>` / `<summary>` so browser find-in-page can search
 * across collapsed bodies.
 *
 * Rendering rules (see COLLAPSIBLE_NESTED.md):
 *   L0          → root (no chrome — just iterate children)
 *   L1, L3, L5… → section (clickable summary + body, top divider)
 *   L2, L4, L6… → island (padded card, alternating layer-0/layer-1)
 */
export const asObjectShortcuts = defineShortcuts({
  // ── Variant containers ────────────────────────────────────
  // Section: top divider + vertical padding, no background of its own.
  // `[&>summary]` rules suppress the native disclosure marker.
  "as-object-section":
    "border-t-1 first:border-t-0 py-$m [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden",
  // Island: padded card with border + rounded corners. Layer is added by
  // `as-object-island-even` / `as-object-island-odd` so the alternation
  // is data-driven from the component (level → modulo).
  "as-object-island":
    "border-1 rounded-r2 p-$m [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden",
  "as-object-island-even": "layer-0",
  "as-object-island-odd": "layer-1",

  // ── Header (clickable summary) ────────────────────────────
  "as-object-summary": "flex items-center gap-$m text-left cursor-pointer group",
  "as-object-header": "flex-1 flex flex-col gap-$xxs min-w-0",
  "as-object-title": "text-body-l font-600 m-0",
  // Nested sections share one smaller uniform size (text-body) regardless
  // of depth — depth is read off chrome alternation, not typography.
  "as-object-title-nested": "text-body font-600 m-0",
  "as-object-description": "text-callout text-current-muted m-0",

  // ── Chevron (rotates 90° CCW when collapsed) ──────────────
  "as-object-chevron":
    "i-as-chevron-down w-[1.1em] h-[1.1em] shrink-0 text-current-muted group-hover:scope-primary group-hover:text-current-hl [transition:transform_150ms_ease]",
  "as-object-chevron-collapsed": "rotate--90",

  // ── Body (sibling of summary, hidden when details closed) ─
  "as-object-body": "mt-$m",

  // ── Inline error (when the struct itself has a validation error) ──
  "as-object-error": "scope-error text-callout text-current-hl mb-$xs",

  // ── Error count badge (collapsed sections with errors inside) ──
  // Uses scope-error so the chip reads as a negative-state pill regardless
  // of the surrounding scope; `surface-500` gives a saturated mid-error
  // chrome that stays legible on any layer.
  "as-object-error-badge":
    "scope-error surface-500 inline-flex items-center justify-center min-w-[1.4em] h-[1.4em] px-$xxs rounded-r0 text-callout font-mono font-600 leading-none shrink-0",

  // ── Optional struct, not yet enabled ──────────────────────
  // Substantial card placeholder so a nested optional struct is visually
  // proportional to what it'll become when filled in (vs the thin
  // "+ No Data" pill used for scalars).
  "as-object-empty":
    "layer-0 border-1 border-dashed rounded-r2 p-$m flex items-center justify-between gap-$m",
  "as-object-empty-content": "flex flex-col gap-$xxs min-w-0",
  "as-object-empty-title": "text-body font-600 m-0 text-current-muted",
  "as-object-empty-add":
    "scope-primary c8-flat h-fingertip-s px-$m rounded-base font-600 text-callout shrink-0",
});
