import type { SemanticPropNode, TAtscriptPlugin, Token } from "@atscript/core";
import { AnnotationSpec, isPrimitive, isRef } from "@atscript/core";

const PATH_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;
const COPY_PRIMITIVES = ["string", "number", "boolean"] as const;
type CopyPrimitive = (typeof COPY_PRIMITIVES)[number];

/**
 * ATScript plugin that registers workflow-specific annotations:
 * - `@wf.context.pass` — whitelist context keys to send to the client form
 * - `@wf.action.withData` — action that sends form data with deep-partial validation
 * - `@wf.store.fromContext` — wf-store: copy a context value into a top-level
 *   column on every `set()` (shadow column for indexable queries)
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
            store: {
              fromContext: new AnnotationSpec({
                description:
                  "Copy a value from `state.context` to a top-level column on every `set()`. " +
                  "Use to add indexable shadow columns (e.g. `approver`) for UIs and queries " +
                  "without forking the base wf-state schema. The JSON `state` blob remains the " +
                  "source of truth — columns are derived. Path: dot-notation only " +
                  "(`approval.approver`); no array indices or wildcards. Field type must be " +
                  "string | number | boolean. Field must be optional or have a default — " +
                  "context shape varies between flow steps and a path-miss writes null.",
                nodeType: ["prop"],
                multiple: false,
                argument: {
                  name: "path",
                  type: "string",
                  description:
                    "Dot-notation path into state.context (e.g. 'approver' or 'approval.approver').",
                },
                validate: validateStoreFromContext,
              }),
            },
          },
        },
      };
    },
  };
}

const validateStoreFromContext: NonNullable<
  ConstructorParameters<typeof AnnotationSpec>[0]["validate"]
> = (token, args, doc) => {
  const errors: ReturnType<NonNullable<typeof validateStoreFromContext>> = [];
  const field = token.parentNode as SemanticPropNode | undefined;
  if (!field) return errors;
  const ann = "@wf.store.fromContext";

  // 1. Path syntax — dot-notation only.
  const path = args[0]?.text;
  if (path !== undefined && !PATH_RE.test(path)) {
    errors.push({
      message: `${ann} '${path}': invalid path — only plain dot-notation is supported (e.g. 'a.b'); arrays, wildcards, and bracket access are not`,
      severity: 1,
      range: token.range,
    });
  }

  // 2. PK rejection — never overwrite the primary key.
  if (field.countAnnotations("meta.id") > 0) {
    errors.push({
      message: `${ann} cannot be applied to @meta.id (primary key) fields — shadow columns must not overwrite the row identifier`,
      severity: 1,
      range: token.range,
    });
  }

  // 3. Field must be optional or have a default — context can be missing between steps.
  const isOptional = (field as unknown as { has(k: string): boolean }).has("optional");
  const hasDefault =
    field.countAnnotations("meta.default") > 0 || field.countAnnotations("db.default") > 0;
  if (!isOptional && !hasDefault) {
    errors.push({
      message: `${ann}: field must be optional (\`?:\`) or carry @meta.default / @db.default — workflow context shape varies between steps and path-misses write null`,
      severity: 1,
      range: token.range,
    });
  }

  // 4. Field's resolved primitive must be string | number | boolean.
  const def = field.getDefinition();
  if (def && isRef(def) && def.id !== undefined) {
    const unwound = doc.unwindType(def.id, def.chain as Token[]);
    if (unwound && isPrimitive(unwound.def)) {
      const ct = (unwound.def as unknown as { config: { type: unknown } }).config.type;
      const baseType =
        typeof ct === "object" && ct !== null
          ? (ct as { kind: string; value?: string }).kind === "final"
            ? (ct as { value: string }).value
            : (ct as { kind: string }).kind
          : (ct as string);
      if (!COPY_PRIMITIVES.includes(baseType as CopyPrimitive)) {
        errors.push({
          message: `${ann} is not compatible with type "${baseType}" — only ${COPY_PRIMITIVES.join(" | ")} are supported (no arrays, objects, decimal, or timestamp)`,
          severity: 1,
          range: token.range,
        });
      }
    } else if (unwound && !isPrimitive(unwound.def)) {
      errors.push({
        message: `${ann}: field must be a primitive — got non-primitive type`,
        severity: 1,
        range: token.range,
      });
    }
  }

  return errors;
};
