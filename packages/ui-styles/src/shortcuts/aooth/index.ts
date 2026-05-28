import { mergeVunorShortcuts } from "vunor/theme";
import { asConsentArrayShortcuts } from "./as-consent-array";
import { asCopyShortcuts } from "./as-copy";
import { asPasswordRulesShortcuts } from "./as-password-rules";
import { asQrCodeShortcuts } from "./as-qr-code";

export { asConsentArrayShortcuts, asCopyShortcuts, asPasswordRulesShortcuts, asQrCodeShortcuts };

export const aoothShortcuts = mergeVunorShortcuts([
  asConsentArrayShortcuts,
  asCopyShortcuts,
  asPasswordRulesShortcuts,
  asQrCodeShortcuts,
]);
