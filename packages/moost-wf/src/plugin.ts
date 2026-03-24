import type { TAtscriptPlugin } from "@atscript/core";
import { AnnotationSpec } from "@atscript/core";

/**
 * ATScript plugin that registers workflow-specific annotations:
 * - `@wf.context.pass` — whitelist context keys to send to the client
 * - `@wf.action.withData` — action that sends form data with deep-partial validation
 *
 * Install in your `atscript.config.ts`:
 * ```ts
 * import wfPlugin from '@atscript/moost-wf/plugin'
 *
 * export default {
 *   plugins: [wfPlugin()],
 * }
 * ```
 */
export default function wfPlugin(): TAtscriptPlugin {
  return {
    name: "moost-wf",
    config() {
      return {
        annotations: {
          wf: {
            context: {
              pass: new AnnotationSpec({
                description:
                  "Whitelist a workflow context key to pass to the client form. " +
                  "Only keys listed here are extracted from workflow state and " +
                  "included in the `inputRequired` response. Prevents accidental " +
                  "leakage of internal state to the browser.",
                nodeType: ["interface", "type"],
                multiple: true,
                mergeStrategy: "append",
                argument: {
                  name: "key",
                  type: "string",
                  description: "Context key name to whitelist",
                },
              }),
            },
            action: {
              withData: new AnnotationSpec({
                description:
                  "Form action that sends partial form data with deep-partial validation. " +
                  "Workflow-only — the server validates filled fields but allows missing ones. " +
                  "Use for actions like 'save draft' where partial data is useful.",
                nodeType: ["prop", "type"],
                argument: {
                  name: "id",
                  type: "string",
                  description: "The action name",
                },
              }),
            },
          },
        },
      };
    },
  };
}
