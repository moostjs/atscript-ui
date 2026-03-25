import type { TAtscriptAnnotatedType, TAtscriptTypeObject } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { extractValueHelp } from "./extract-ref";

function getProp(type: TAtscriptAnnotatedType, name: string): TAtscriptAnnotatedType {
  return (type.type as TAtscriptTypeObject).props.get(name)!;
}

describe("extractValueHelp", () => {
  it("returns ValueHelpInfo for a valid FK ref with dict annotations", async () => {
    const { BookForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const { Author } = await import("../__tests__/fixtures/value-help-target.as");
    const fk = getProp(BookForm, "authorId");
    const info = extractValueHelp(fk);

    expect(info).toBeDefined();
    expect(info!.path).toBe("/authors");
    expect(info!.targetField).toBe("id");
    expect(info!.primaryKeys).toEqual(["id"]);
    expect(info!.labelField).toBe("name");
    expect(info!.descrField).toBe("bio");
    expect(info!.attrFields).toEqual(["email", "country"]);
    expect(info!.targetType).toBe(Author as unknown as TAtscriptAnnotatedType);
  });

  it("returns undefined for prop without .ref", async () => {
    const { BookForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const title = getProp(BookForm, "title");
    expect(extractValueHelp(title)).toBeUndefined();
  });

  it("returns undefined when target lacks @db.http.path", async () => {
    const { OrphanRefForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(OrphanRefForm, "orphanId");
    expect(extractValueHelp(fk)).toBeUndefined();
  });

  it("auto-infers labelField as first non-PK string field when no @ui.dict.label", async () => {
    const { ArticleForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(ArticleForm, "categoryId");
    const info = extractValueHelp(fk);

    expect(info).toBeDefined();
    expect(info!.labelField).toBe("title");
  });

  it("returns undefined when no label can be inferred", async () => {
    const { NumericRefForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(NumericRefForm, "codeId");
    expect(extractValueHelp(fk)).toBeUndefined();
  });

  it("collects multiple @ui.dict.attr fields", async () => {
    const { BookForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(BookForm, "authorId");
    const info = extractValueHelp(fk);

    expect(info!.attrFields).toEqual(["email", "country"]);
  });

  it("caches result (same prop returns same object)", async () => {
    const { ArticleForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(ArticleForm, "categoryId");
    const a = extractValueHelp(fk);
    const b = extractValueHelp(fk);

    expect(a).toBe(b);
  });
});
