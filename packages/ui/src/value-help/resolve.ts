import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeFinal,
  TAtscriptTypeObject,
} from "@atscript/typescript/utils";
import { getMetaEntry, resetMetaCache } from "../shared/meta-cache";
import { META_ID, UI_DICT_ATTR, UI_DICT_DESCR, UI_DICT_LABEL } from "../shared/annotation-keys";
import type { MetaResponse } from "../table/types";

/**
 * Field-role + capability metadata for a value-help target, lazily resolved
 * from the target's own `/meta` endpoint.
 */
export interface ResolvedValueHelp {
  url: string;
  primaryKeys: string[];
  labelField: string;
  descrField: string | undefined;
  attrFields: string[];
  filterableFields: string[];
  sortableFields: string[];
  searchable: boolean;
  targetType: TAtscriptAnnotatedType;
}

/**
 * Lazily fetch and extract value-help metadata for the given URL.
 *
 * - Issues exactly one `GET {url}/meta` per URL across the session (shared via meta-cache).
 * - Concurrent callers with the same URL share the in-flight promise.
 * - If the underlying fetch rejects, the cache entry is evicted so a later
 *   retry performs a fresh fetch.
 */
export function resolveValueHelp(url: string): Promise<ResolvedValueHelp> {
  const entry = getMetaEntry(url);
  if (entry.resolved) return entry.resolved;
  entry.resolved = Promise.all([entry.meta, entry.type]).then(([meta, type]) =>
    buildResolved(url, meta, type),
  );
  return entry.resolved;
}

/** Thin alias over `resetMetaCache` — retained so existing test code keeps working. */
export function resetValueHelpCache(): void {
  resetMetaCache();
}

function buildResolved(
  url: string,
  meta: MetaResponse,
  targetType: TAtscriptAnnotatedType,
): ResolvedValueHelp {
  const objectType =
    targetType.type.kind === "object" ? (targetType.type as TAtscriptTypeObject) : undefined;

  const primaryKeys: string[] = [];
  let labelField: string | undefined;
  let descrField: string | undefined;
  const attrFields: string[] = [];
  let firstStringField: string | undefined;

  if (objectType) {
    for (const [name, fieldProp] of objectType.props) {
      const isPK = fieldProp.metadata.has(META_ID);
      if (isPK) primaryKeys.push(name);

      if (fieldProp.metadata.has(UI_DICT_LABEL)) labelField = name;
      if (fieldProp.metadata.has(UI_DICT_DESCR)) descrField = name;
      if (fieldProp.metadata.has(UI_DICT_ATTR)) attrFields.push(name);

      if (
        !firstStringField &&
        !isPK &&
        fieldProp.type.kind === "" &&
        (fieldProp.type as TAtscriptTypeFinal).designType === "string"
      ) {
        firstStringField = name;
      }
    }
  }

  if (!labelField) labelField = firstStringField;
  if (!labelField) labelField = primaryKeys[0] ?? "id";

  const filterableFields: string[] = [];
  const sortableFields: string[] = [];
  if (meta.fields) {
    for (const [name, fm] of Object.entries(meta.fields)) {
      if (fm?.filterable) filterableFields.push(name);
      if (fm?.sortable) sortableFields.push(name);
    }
  }

  return {
    url,
    primaryKeys,
    labelField,
    descrField,
    attrFields,
    filterableFields,
    sortableFields,
    searchable: !!meta.searchable,
    targetType,
  };
}
