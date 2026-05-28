import { defineShortcuts } from "vunor/theme";

export const asQrCodeShortcuts = defineShortcuts({
  // Stacks SVG + manual-secret vertically. AsFieldShell's `as-field-input-row`
  // is `flex items-center` — without this wrapper our two children would
  // render side-by-side instead of stacked.
  "as-qr-code-stack": "flex flex-col items-center gap-$s w-full",
  // Constrain the SVG output — qrcode emits a self-sizing root <svg>; pin
  // it to a square so the field doesn't reflow.
  "as-qr-code-svg": "[&_svg]:block [&_svg]:w-full [&_svg]:h-full w-[12rem] h-[12rem]",
  "as-qr-code-secret": "font-mono text-body select-all text-center break-all tracking-wider",
  "as-qr-code-error": "scope-error text-callout",
});
