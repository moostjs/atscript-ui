import type {
  TAtscriptAnnotatedType,
  TAtscriptTypeObject,
  TSerializedAnnotatedType,
} from "@atscript/typescript/utils";
import {
  defineAnnotatedType,
  deserializeAnnotatedType,
  serializeAnnotatedType,
} from "@atscript/typescript/utils";
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

describe("extractValueHelp — reference chains", () => {
  it("resolves a one-hop chain: view field → FK field → dictionary", async () => {
    const { IssueView } = await import("../__tests__/fixtures/value-help-fk.as");
    const info = extractValueHelp(getProp(IssueView, "errorCode"));

    expect(info).toEqual({ url: "/error-codes", targetField: "code" });
  });

  it("resolves a two-hop chain", async () => {
    const { IssueReportView } = await import("../__tests__/fixtures/value-help-fk.as");
    const info = extractValueHelp(getProp(IssueReportView, "errorCode"));

    expect(info).toEqual({ url: "/error-codes", targetField: "code" });
  });

  it("returns undefined for a chain that never reaches an FK link", async () => {
    const { PlainNoteView } = await import("../__tests__/fixtures/value-help-fk.as");
    expect(extractValueHelp(getProp(PlainNoteView, "note"))).toBeUndefined();
  });

  it("gives up on a cyclic chain instead of looping", () => {
    // Two interfaces referencing each other's field — impossible to express in
    // a single `.as` file, so the nodes are built with the runtime builder.
    const left = defineAnnotatedType("object");
    const right = defineAnnotatedType("object");
    left.prop(
      "f",
      defineAnnotatedType()
        .designType("string")
        .refTo(() => right.$type, ["f"]).$type,
    );
    right.prop(
      "f",
      defineAnnotatedType()
        .designType("string")
        .refTo(() => left.$type, ["f"]).$type,
    );

    expect(extractValueHelp(getProp(left.$type, "f"))).toBeUndefined();
  });

  it("resolves a view field whose chain the SERVER already collapsed (/meta, @atscript/db >= 0.1.128)", () => {
    // Serialized shape produced by `/meta` for a view field declared as
    // `errorCode: Issue.errorCode` where `Issue.errorCode: ErrorCode.code`
    // carries the FK: `db.rel.FK` is lifted onto the view field and `ref`
    // points straight at the terminal dictionary as a shallow
    // `{ id, metadata }` target (the unchanged `refDepth: 0.5`).
    const serialized = {
      $v: 2,
      metadata: { "db.view": true, "db.http.path": "/issue-view" },
      type: {
        kind: "object",
        tags: [],
        propsPatterns: [],
        props: {
          errorCode: {
            metadata: { "db.rel.FK": true },
            type: { kind: "", designType: "string", tags: [] },
            ref: {
              field: "code",
              type: { id: "ErrorCode", metadata: { "db.http.path": "/error-codes" } },
            },
          },
        },
      },
    } as unknown as TSerializedAnnotatedType;

    const viewType = deserializeAnnotatedType(serialized);
    const info = extractValueHelp(getProp(viewType, "errorCode"));

    expect(info).toEqual({ url: "/error-codes", targetField: "code" });
  });
});

describe("extractValueHelp — @ui.valueHelp binding", () => {
  it("resolves the target path, field, filter and pinned fields", async () => {
    const { Ticket } = await import("../__tests__/fixtures/value-help-binding.as");
    const info = extractValueHelp(getProp(Ticket, "color"));

    expect(info).toEqual({
      url: "/attribute-values",
      targetField: "value",
      filter: { attribute: { $eq: "color" } },
      pinned: ["attribute"],
    });
  });

  it("translates an `and` filter and pins only `=` fields", async () => {
    const { Ticket } = await import("../__tests__/fixtures/value-help-binding.as");
    const info = extractValueHelp(getProp(Ticket, "size"));

    expect(info?.filter).toEqual({
      $and: [{ attribute: { $eq: "size" } }, { active: { $eq: true } }],
    });
    expect(info?.pinned).toEqual(["attribute", "active"]);
  });

  it("a binding without a filter carries neither filter nor pinned", async () => {
    const { Ticket } = await import("../__tests__/fixtures/value-help-binding.as");
    expect(extractValueHelp(getProp(Ticket, "currency"))).toEqual({
      url: "/currencies",
      targetField: "code",
    });
  });

  it("beats @db.rel.FK on the same field", async () => {
    const { Ticket } = await import("../__tests__/fixtures/value-help-binding.as");
    expect(extractValueHelp(getProp(Ticket, "authorId"))).toEqual({
      url: "/currencies",
      targetField: "id",
    });
  });

  it("falls back to the FK walk when the target has no http path", async () => {
    const { Ticket } = await import("../__tests__/fixtures/value-help-binding.as");
    expect(extractValueHelp(getProp(Ticket, "fallbackAuthor"))).toEqual({
      url: "/authors",
      targetField: "id",
    });
  });

  it("travels through a chain ref declared in another file", async () => {
    const { TicketView } = await import("../__tests__/fixtures/value-help-binding-view.as");
    expect(extractValueHelp(getProp(TicketView, "color"))).toMatchObject({
      url: "/attribute-values",
      targetField: "value",
      pinned: ["attribute"],
    });
  });

  it("travels through extends", async () => {
    const { TicketExtended } = await import("../__tests__/fixtures/value-help-binding.as");
    expect(extractValueHelp(getProp(TicketExtended, "color"))?.url).toBe("/attribute-values");
  });

  it("reads the serialized shape from /meta ({ id, metadata } target, plain filter tree)", () => {
    const serialized = {
      $v: 2,
      metadata: {},
      type: {
        kind: "object",
        tags: [],
        propsPatterns: [],
        props: {
          color: {
            metadata: {
              "ui.valueHelp": {
                target: { id: "AttributeValue", metadata: { "db.http.path": "/attribute-values" } },
                field: "value",
                filter: { left: { field: "attribute" }, op: "$eq", right: "color" },
              },
            },
            type: { kind: "", designType: "string", tags: [] },
          },
        },
      },
    } as unknown as TSerializedAnnotatedType;

    const info = extractValueHelp(getProp(deserializeAnnotatedType(serialized), "color"));
    expect(info).toEqual({
      url: "/attribute-values",
      targetField: "value",
      filter: { attribute: { $eq: "color" } },
      pinned: ["attribute"],
    });
  });

  it("ignores a serialized binding whose target lost its path (empty shallow target)", () => {
    const serialized = {
      $v: 2,
      metadata: {},
      type: {
        kind: "object",
        tags: [],
        propsPatterns: [],
        props: {
          color: {
            metadata: { "ui.valueHelp": { target: { id: "X" }, field: "value" } },
            type: { kind: "", designType: "string", tags: [] },
          },
        },
      },
    } as unknown as TSerializedAnnotatedType;
    expect(
      extractValueHelp(getProp(deserializeAnnotatedType(serialized), "color")),
    ).toBeUndefined();
  });
});

describe("extractValueHelp — binding hosted on a @db.view", () => {
  const EXPECTED = {
    url: "/attribute-values",
    targetField: "value",
    filter: { attribute: { $eq: "color" } },
    pinned: ["attribute"],
  };

  it("the compiled view column inherits the binding through its chain ref", async () => {
    const { ItemView } = await import("../__tests__/fixtures/value-help-binding-dbview.as");
    expect(extractValueHelp(getProp(ItemView, "color"))).toEqual(EXPECTED);
  });

  it("the serialized view (the /meta shape a moost-db controller sends) resolves the same", async () => {
    const { ItemView } = await import("../__tests__/fixtures/value-help-binding-dbview.as");
    // refDepth 0.5 is what moost-db's /meta uses: the binding target arrives as `{ id, metadata }`.
    const serialized = serializeAnnotatedType(ItemView, { refDepth: 0.5 });
    const wire = JSON.parse(JSON.stringify(serialized)) as TSerializedAnnotatedType;
    const color = (wire.type as { props: Record<string, { metadata: Record<string, unknown> }> })
      .props.color;
    const binding = color.metadata["ui.valueHelp"] as {
      target: { id: string; metadata: Record<string, unknown> };
      field: string;
      filter: unknown;
    };

    expect(binding.target.id).toBe("AttributeValue");
    expect(binding.target.metadata["db.http.path"]).toBe("/attribute-values");
    expect(binding.field).toBe("value");
    expect(binding.filter).toEqual({ left: { field: "attribute" }, op: "$eq", right: "color" });

    expect(extractValueHelp(getProp(deserializeAnnotatedType(wire), "color"))).toEqual(EXPECTED);
  });
});
