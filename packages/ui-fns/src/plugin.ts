import type { TAtscriptPlugin } from "@atscript/core";
import { uiFnsAnnotations } from "./plugin/annotations";

/**
 * ATScript plugin that registers `ui.fn.*` computed annotations and `ui.validate`.
 *
 * Install in your `atscript.config.ts`:
 * ```ts
 * import { uiFnsPlugin } from '@atscript/ui-fns/plugin'
 *
 * export default {
 *   plugins: [uiFnsPlugin()],
 * }
 * ```
 */
export function uiFnsPlugin(): TAtscriptPlugin {
  return {
    name: "ui-fns",
    config() {
      return { annotations: uiFnsAnnotations };
    },
  };
}
