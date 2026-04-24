import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { DB_HTTP_PATH, DB_REL_FK } from "../shared/annotation-keys";
import type { ValueHelpInfo } from "./types";

/**
 * Synchronous probe. Returns `{ url, targetField }` iff:
 *   1. the prop carries `@db.rel.FK`,
 *   2. the prop has a `.ref`,
 *   3. the ref's target metadata carries `@db.http.path`.
 */
export function extractValueHelp(prop: TAtscriptAnnotatedType): ValueHelpInfo | undefined {
  if (!prop.metadata.has(DB_REL_FK)) return undefined;
  if (!prop.ref) return undefined;

  const target = prop.ref.type();
  if (!target) return undefined;

  const url = target.metadata.get(DB_HTTP_PATH) as string | undefined;
  if (!url) return undefined;

  return { url, targetField: prop.ref.field };
}
