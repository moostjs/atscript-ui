import type { TAtscriptPlugin } from "@atscript/core";
import { uiFnsAnnotations } from "./plugin/annotations";

/**
 * ATScript plugin that registers `ui.form.fn.*` / `ui.table.fn.*` computed annotations and `ui.form.validate`.
 *
 * Static `@ui.*` annotations and UI primitives are provided by `@atscript/ui/plugin`.
 *
 * Install in your `atscript.config.ts`:
 * ```ts
 * import uiFnsPlugin from '@atscript/ui-fns/plugin'
 *
 * export default {
 *   plugins: [uiFnsPlugin()],
 * }
 * ```
 */
export default function uiFnsPlugin(): TAtscriptPlugin {
  return {
    name: "ui-fns",
    config() {
      return { annotations: uiFnsAnnotations };
    },
  };
}
