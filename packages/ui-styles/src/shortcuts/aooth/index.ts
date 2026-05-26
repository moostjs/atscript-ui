import { mergeVunorShortcuts } from "vunor/theme";
import { asConsentArrayShortcuts } from "./as-consent-array";
import { asPasswordRulesShortcuts } from "./as-password-rules";

export { asConsentArrayShortcuts, asPasswordRulesShortcuts };

export const aoothShortcuts = mergeVunorShortcuts([
  asConsentArrayShortcuts,
  asPasswordRulesShortcuts,
]);
