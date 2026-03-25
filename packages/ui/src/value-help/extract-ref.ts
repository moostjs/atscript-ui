import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeFinal,
  TAtscriptTypeObject,
} from "@atscript/typescript/utils";
import type { ValueHelpInfo } from "./types";
import { META_ID, UI_DICT_ATTR, UI_DICT_DESCR, UI_DICT_LABEL } from "../shared/annotation-keys";

const DB_HTTP_PATH = "db.http.path" as keyof AtscriptMetadata;

const cache = new WeakMap<TAtscriptAnnotatedType, ValueHelpInfo | undefined>();

/**
 * Extracts value-help metadata from an FK field's `.ref`.
 *
 * Returns `undefined` if the field has no `.ref` or the target table
 * lacks `@db.http.path`.
 */
export function extractValueHelp(prop: TAtscriptAnnotatedType): ValueHelpInfo | undefined {
  if (!prop.ref) return undefined;
  if (cache.has(prop)) return cache.get(prop);

  const result = extract(prop);
  cache.set(prop, result);
  return result;
}

function extract(prop: TAtscriptAnnotatedType): ValueHelpInfo | undefined {
  const target = prop.ref!.type();
  if (!target || target.type.kind !== "object") return undefined;

  const path = target.metadata.get(DB_HTTP_PATH) as string | undefined;
  if (!path) return undefined;

  const targetField = prop.ref!.field;
  const objectType = target.type as TAtscriptTypeObject;
  const primaryKeys: string[] = [];
  let labelField: string | undefined;
  let descrField: string | undefined;
  const attrFields: string[] = [];
  let firstStringField: string | undefined;

  for (const [name, fieldProp] of objectType.props) {
    const isPK = fieldProp.metadata.has(META_ID);
    if (isPK) primaryKeys.push(name);

    if (fieldProp.metadata.has(UI_DICT_LABEL)) {
      labelField = name;
    }
    if (fieldProp.metadata.has(UI_DICT_DESCR)) {
      descrField = name;
    }
    if (fieldProp.metadata.has(UI_DICT_ATTR)) {
      attrFields.push(name);
    }

    if (
      !firstStringField &&
      !isPK &&
      fieldProp.type.kind === "" &&
      (fieldProp.type as TAtscriptTypeFinal).designType === "string"
    ) {
      firstStringField = name;
    }
  }

  if (!labelField) labelField = firstStringField;

  if (!labelField) return undefined;

  return {
    path,
    targetField,
    primaryKeys,
    labelField,
    descrField,
    attrFields,
    targetType: target,
  };
}
