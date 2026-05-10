import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import {
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_COLUMN_PRECISION,
  DB_UNIT,
  DB_UNIT_REF,
} from "../shared/annotation-keys";
import { getFieldMeta } from "../shared/field-resolver";

/**
 * Resolved measurement annotations — currency / unit-of-measure / numeric
 * precision. Read once at form/table-def construction time and surfaced as
 * already-resolved values so downstream renderers (cells, default form
 * components, custom inputs) never re-read annotation metadata.
 */
export interface MeasurementInfo {
  /** Literal currency code from `@db.amount.currency 'EUR'`. */
  currencyCode?: string;
  /** Sibling-field path from `@db.amount.currency.ref 'fieldName'`. */
  currencyRefField?: string;
  /** Literal unit-of-measure from `@db.unit 'kg'`. */
  unitCode?: string;
  /** Sibling-field path from `@db.unit.ref 'fieldName'`. */
  unitRefField?: string;
  /** Decimal scale (fraction digits) — second arg of `@db.column.precision precision, scale`. */
  precisionScale?: number;
}

/**
 * Read measurement annotations off a single field prop. Returns `undefined`
 * for any annotation that's absent — callers can spread the result into a
 * larger record.
 */
export function extractMeasurement(prop: TAtscriptAnnotatedType): MeasurementInfo {
  const precisionMeta = getFieldMeta(prop, DB_COLUMN_PRECISION) as
    | { precision: number; scale: number }
    | undefined;
  return {
    currencyCode: getFieldMeta(prop, DB_AMOUNT_CURRENCY) as string | undefined,
    currencyRefField: getFieldMeta(prop, DB_AMOUNT_CURRENCY_REF) as string | undefined,
    unitCode: getFieldMeta(prop, DB_UNIT) as string | undefined,
    unitRefField: getFieldMeta(prop, DB_UNIT_REF) as string | undefined,
    precisionScale: precisionMeta?.scale,
  };
}
