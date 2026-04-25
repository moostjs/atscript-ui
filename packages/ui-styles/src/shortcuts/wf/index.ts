import { mergeVunorShortcuts } from "vunor/theme";
import { asWfFormShortcuts } from "./as-wf-form";

export { asWfFormShortcuts };

export const wfShortcuts = mergeVunorShortcuts([asWfFormShortcuts]);
