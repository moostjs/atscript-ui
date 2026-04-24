import type { TAtscriptAnnotatedType, TAtscriptTypeObject } from "@atscript/typescript/utils";
import { describe, expect, it } from "vitest";
import { extractValueHelp } from "./extract-ref";

function getProp(type: TAtscriptAnnotatedType, name: string): TAtscriptAnnotatedType {
  return (type.type as TAtscriptTypeObject).props.get(name)!;
}

describe("extractValueHelp", () => {
  it("returns { url, targetField } when @db.rel.FK + .ref + target db.http.path all present", async () => {
    const { BookForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(BookForm, "authorId");
    const info = extractValueHelp(fk);

    expect(info).toBeDefined();
    expect(info!.url).toBe("/authors");
    expect(info!.targetField).toBe("id");
  });

  it("returns undefined for prop without @db.rel.FK even with .ref + target path", async () => {
    const { UnannotatedRefForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(UnannotatedRefForm, "authorId");
    expect(extractValueHelp(fk)).toBeUndefined();
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

  it("returns info for FK even when target has no dict annotations (lazy resolver handles label fallback)", async () => {
    const { ArticleForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(ArticleForm, "categoryId");
    const info = extractValueHelp(fk);

    expect(info).toBeDefined();
    expect(info!.url).toBe("/categories");
    expect(info!.targetField).toBe("id");
  });

  it("returns info even when target has only numeric props (label inference moved to resolver)", async () => {
    const { NumericRefForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(NumericRefForm, "codeId");
    const info = extractValueHelp(fk);

    expect(info).toBeDefined();
    expect(info!.url).toBe("/codes");
    expect(info!.targetField).toBe("code");
  });

  it("passes through when combined with other annotations like @ui.type", async () => {
    const { OverriddenForm } = await import("../__tests__/fixtures/value-help-fk.as");
    const fk = getProp(OverriddenForm, "authorId");
    const info = extractValueHelp(fk);

    expect(info).toBeDefined();
    expect(info!.url).toBe("/authors");
  });
});
