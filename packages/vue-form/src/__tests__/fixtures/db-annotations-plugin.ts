import { AnnotationSpec, type TAtscriptPlugin } from "@atscript/core";

/**
 * Minimal test-only ATScript plugin registering the `@db.*` annotations used by
 * the change-tracking fixtures (`patch-forms.as`).
 *
 * vue-form does NOT depend on `@atscript/db` at runtime — `@atscript/ui`'s diff
 * engine reads these annotation keys generically off the annotated type — so we
 * declare just enough here for the parser to accept the fixtures, rather than
 * pulling in `@atscript/db/plugin` as a dependency.
 *
 * Imported by BOTH `atscript.config.mts` (the `unplugin-atscript` transform that
 * compiles `.as` imports at test time) AND `global-setup.ts` (`prepareFixtures`),
 * so the two parser passes agree on the annotation set.
 */
export function dbAnnotationsPlugin(): TAtscriptPlugin {
  return {
    name: "db-annotations-test",
    config() {
      return {
        annotations: {
          db: {
            column: {
              version: new AnnotationSpec({
                description: "Optimistic-concurrency version column.",
                nodeType: ["prop"],
              }),
            },
            patch: {
              strategy: new AnnotationSpec({
                description: "Nested-object patch strategy ('merge' | 'replace').",
                nodeType: ["prop", "type"],
                argument: { name: "strategy", type: "string" },
              }),
            },
          },
        },
      };
    },
  };
}
