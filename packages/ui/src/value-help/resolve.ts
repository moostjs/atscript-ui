import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeFinal,
  TAtscriptTypeObject,
} from "@atscript/typescript/utils";
import type { ClientFactory } from "../client-factory";
import { getMetaEntry, resetMetaCache, type MetaEntryOptions } from "../shared/meta-cache";
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
 * - Issues exactly one `GET {url}/meta` per URL and UI locale across the
 *   session (shared via meta-cache).
 * - Concurrent callers with the same URL share the in-flight promise.
 * - If the underlying fetch rejects, the cache entry is evicted so a later
 *   retry performs a fresh fetch.
 *
 * `options.texts` — the app's UI texts (see `getMetaEntry`); the active ones
 * by default. `options.clientFactory` — the factory the host (a form's or a
 * table's `clientFactory`) builds its clients with: it seeds the client when
 * this call creates the entry for the URL and locale (default: the app-wide
 * one). Since 0.1.168.
 */
export function resolveValueHelp(
  url: string,
  options?: Pick<MetaEntryOptions, "texts"> & { clientFactory?: ClientFactory },
): Promise<ResolvedValueHelp> {
  const entry = getMetaEntry(url, options?.clientFactory, { texts: options?.texts });
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
  const versionColumn = meta.versionColumn;

  const primaryKeys: string[] = [];
  let labelField: string | undefined;
  let descrField: string | undefined;
  const attrFields: string[] = [];
  let firstStringField: string | undefined;

  if (objectType) {
    for (const [name, fieldProp] of objectType.props) {
      if (name === versionColumn) continue;
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
      if (name === versionColumn) continue;
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
