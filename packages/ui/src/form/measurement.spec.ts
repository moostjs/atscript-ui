import { defineAnnotatedType } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import {
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_COLUMN_PRECISION,
  DB_UNIT,
  DB_UNIT_REF,
} from "../shared/annotation-keys";
import { extractMeasurement } from "./measurement";

describe("extractMeasurement", () => {
  it("returns an empty record when no annotations are present", () => {
    const prop = defineAnnotatedType().designType("number").$type;
    expect(extractMeasurement(prop)).toEqual({
      currencyCode: undefined,
      currencyRefField: undefined,
      unitCode: undefined,
      unitRefField: undefined,
      precisionScale: undefined,
    });
  });

  it("reads `@db.amount.currency` literal onto currencyCode", () => {
    const prop = defineAnnotatedType()
      .designType("number")
      .annotate(DB_AMOUNT_CURRENCY as keyof AtscriptMetadata, "USD" as never).$type;
    expect(extractMeasurement(prop).currencyCode).toBe("USD");
  });

  it("reads `@db.amount.currency.ref` onto currencyRefField", () => {
    const prop = defineAnnotatedType()
      .designType("number")
      .annotate(DB_AMOUNT_CURRENCY_REF as keyof AtscriptMetadata, "currency" as never).$type;
    expect(extractMeasurement(prop).currencyRefField).toBe("currency");
  });

  it("reads `@db.unit` literal onto unitCode", () => {
    const prop = defineAnnotatedType()
      .designType("number")
      .annotate(DB_UNIT as keyof AtscriptMetadata, "kg" as never).$type;
    expect(extractMeasurement(prop).unitCode).toBe("kg");
  });

  it("reads `@db.unit.ref` onto unitRefField", () => {
    const prop = defineAnnotatedType()
      .designType("number")
      .annotate(DB_UNIT_REF as keyof AtscriptMetadata, "unit" as never).$type;
    expect(extractMeasurement(prop).unitRefField).toBe("unit");
  });

  it("reads scale from `@db.column.precision precision, scale`", () => {
    const prop = defineAnnotatedType()
      .designType("number")
      .annotate(
        DB_COLUMN_PRECISION as keyof AtscriptMetadata,
        { precision: 10, scale: 2 } as never,
      ).$type;
    expect(extractMeasurement(prop).precisionScale).toBe(2);
  });
});
