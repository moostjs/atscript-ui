import { mergeVunorShortcuts } from "vunor/theme";
import { asConsentArrayShortcuts } from "./as-consent-array";
import { asCopyShortcuts } from "./as-copy";
import { asPasswordRulesShortcuts } from "./as-password-rules";
import { asQrCodeShortcuts } from "./as-qr-code";
import { asSsoProvidersShortcuts } from "./as-sso-providers";

export {
  asConsentArrayShortcuts,
  asCopyShortcuts,
  asPasswordRulesShortcuts,
  asQrCodeShortcuts,
  asSsoProvidersShortcuts,
};

export const aoothShortcuts = mergeVunorShortcuts([
  asConsentArrayShortcuts,
  asCopyShortcuts,
  asPasswordRulesShortcuts,
  asQrCodeShortcuts,
  asSsoProvidersShortcuts,
]);
