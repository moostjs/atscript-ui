import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  build,
  getFieldPathCompletionScope,
  getQueryScope,
  getValueCandidates,
  resolveFieldRefAt,
} from "@atscript/core";
import type { AtscriptDoc } from "@atscript/core";
import { tsPlugin } from "@atscript/typescript";
import { dbPlugin } from "@atscript/db/plugin";
import { describe, expect, it } from "vitest";

import uiPlugin from "../plugin";

const DICT = `
@db.table 'attribute_values'
@db.http.path '/attribute-values'
export interface AttributeValue {
    @meta.id
    attribute: string
    @meta.id
    value: string
    @ui.dict.label
    label: string
    active: boolean
    meta: { a: string }
    tags: string[]
}

@db.table 'countries'
@db.http.path '/countries'
export interface Country {
    @meta.id
    code: string
    name: string
}

@db.table 'ranks'
@db.http.path '/ranks'
export interface Rank {
    @meta.id
    id: number
    @db.index.unique
    level: number
}

@db.table 'manual_dict'
@db.http.path '/manual-dict'
@db.table.filterable 'manual'
export interface ManualDict {
    @meta.id
    id: string
    @db.column.filterable
    kind: string
    other: string
}

@db.alias Country
export type CountryAlias = Country

// Not served by a DB controller and no path: a binding to it cannot work.
export interface Unserved {
    @meta.id
    code: string
}

// A table without a literal path is fine: its controller stamps the path at runtime.
@db.table 'no_path'
export interface NoPathDict {
    @meta.id
    code: string
}

export interface Plain { x: string }
export type Status = 'open' | 'closed'
export type Level = 1 | 2
`;

async function compile(
  body: string,
): Promise<{ doc: AtscriptDoc; messages: string[]; text: string }> {
  const rootDir = mkdtempSync(join(tmpdir(), "ui-vh-"));
  const text = `${DICT}\n${body}`;
  writeFileSync(join(rootDir, "t.as"), text);
  const repo = await build({
    rootDir,
    entries: ["t.as"],
    plugins: [tsPlugin(), dbPlugin(), uiPlugin()],
  });
  const doc = repo.getDoc(`file://${join(rootDir, "t.as")}`)!;
  const messages = doc
    .getDiagMessages()
    .map((m) => `${Number(m.severity) === 1 ? "E" : "W"}: ${m.message}`);
  return { doc, messages, text };
}

const msgs = async (body: string) => (await compile(body)).messages;

describe("@ui.valueHelp diagnostics", () => {
  it("accepts a valid binding with a pinned composite key", async () => {
    const m = await msgs(`
export interface Host {
    @ui.valueHelp AttributeValue, 'value', \`attribute = 'color'\`
    color: string
    @ui.valueHelp Country, 'code'
    country: string
    @ui.valueHelp Rank, 'level'
    rank: number
}`);
    expect(m).toEqual([]);
  });

  it("works through chain refs", async () => {
    const m = await msgs(`
export interface Base {
    @ui.valueHelp Country, 'code'
    country: string
}
export interface View { country: Base.country }`);
    expect(m).toEqual([]);
  });

  it("VH1: target is not an interface / is an alias / unknown", async () => {
    const m = await msgs(`
export interface Host {
    @ui.valueHelp Status, 'x'
    a: string
    @ui.valueHelp CountryAlias, 'code'
    b: string
    @ui.valueHelp Nope, 'code'
    c: string
}`);
    expect(m.filter((x) => x.startsWith("E") && !x.includes("Unknown identifier"))).toHaveLength(3);
    expect(m.join("\n")).toContain("CountryAlias");
    expect(m.join("\n")).toContain("Unknown type 'Nope'");
  });

  it("VH2: unknown, dotted and non-scalar fields", async () => {
    const m = (
      await msgs(`
export interface Host {
    @ui.valueHelp Country, 'nope'
    a: string
    @ui.valueHelp AttributeValue, 'meta.a'
    b: string
    @ui.valueHelp AttributeValue, 'meta'
    c: string
    @ui.valueHelp AttributeValue, 'tags'
    d: string
}`)
    ).join("\n");
    expect(m).toContain("Field 'nope' does not exist on 'Country'");
    expect(m).toContain("not a dotted path");
    expect(m).toContain("'AttributeValue.meta' must be a scalar");
    expect(m).toContain("'AttributeValue.tags' must be a scalar");
  });

  it("VH3: host type must equal the target field type", async () => {
    const m = await msgs(`
export interface Host {
    @ui.valueHelp Rank, 'level'
    a: string
    @ui.valueHelp Country, 'code'
    b?: Status
    @ui.valueHelp Country, 'code'
    c: string[]
}`);
    expect(m).toContain("E: Value-help field 'Rank.level' is number, 'a' is string");
    expect(m.filter((x) => x.includes("is string, 'c' is array"))).toHaveLength(1);
    expect(m.filter((x) => x.includes("'b'"))).toEqual([]);
  });

  it("VH4 / VH5: filter scope and literal-only comparisons", async () => {
    const m = (
      await msgs(`
export interface Host {
    @ui.valueHelp AttributeValue, 'value', \`Country.name = 'x'\`
    a: string
    @ui.valueHelp AttributeValue, 'value', \`label = 'x' and attribute = value\`
    b: string
    @ui.valueHelp AttributeValue, 'value', \`missing = 'x'\`
    c: string
}`)
    ).join("\n");
    expect(m).toContain("'Country' which is not in scope");
    expect(m).toContain("a value-help filter compares target fields with literal values");
    expect(m).toContain("Field 'missing' does not exist on 'AttributeValue'");
  });

  it("VH6: repeating values warn; pinned composite and unique do not", async () => {
    const m = await msgs(`
export interface Host {
    @ui.valueHelp AttributeValue, 'value'
    a: string
    @ui.valueHelp AttributeValue, 'label'
    b: string
    @ui.valueHelp AttributeValue, 'value', \`attribute = 'x'\`
    c: string
}`);
    const warnings = m.filter((x) => x.startsWith("W"));
    expect(warnings).toHaveLength(2);
    expect(warnings.join()).toContain("values may repeat in the picker");
  });

  it("a target that is no table / view and has no @db.http.path warns that the binding falls back to the FK", async () => {
    const m = await msgs(`
export interface Host {
    @ui.valueHelp Unserved, 'code'
    a: string
    @ui.valueHelp Country, 'code'
    b: string
}`);
    const w = m.filter((x) => x.startsWith("W"));
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("'Unserved' is not a @db.table / @db.view and has no @db.http.path");
  });

  it("a normal binding gives no warning: a @db.table without a literal path, and a @db.view target", async () => {
    const m = await msgs(`
@db.view 'country_view'
@db.view.for Country
export interface CountryView {
    @meta.id
    code: Country.code
}
export interface Host {
    @ui.valueHelp NoPathDict, 'code'
    a: string
    @ui.valueHelp CountryView, 'code'
    b: string
}`);
    expect(m).toEqual([]);
  });

  it("a binding hosted on a @db.view column (also through a chain) is accepted without warnings", async () => {
    const m = await msgs(`
@db.table 'orders_h'
export interface OrderBase {
    @meta.id
    id: number
    @ui.valueHelp AttributeValue, 'value', \`attribute = 'color'\`
    color: string
}
@db.view 'orders_v'
@db.view.for OrderBase
export interface OrderView {
    id: OrderBase.id
    color: OrderBase.color
}`);
    expect(m).toEqual([]);
  });

  it("VH7: manual-filterable target needs @db.column.filterable on filter fields", async () => {
    const m = await msgs(`
export interface Host {
    @ui.valueHelp ManualDict, 'id', \`kind = 'a' and other = 'b'\`
    a: string
}`);
    expect(m.filter((x) => x.startsWith("W")).join()).toContain(
      "'other' needs @db.column.filterable",
    );
    expect(m.join()).not.toContain("'kind' needs");
  });

  it("VH8: navigation field and distinct combination", async () => {
    const m = (
      await msgs(`
@db.table 'hosts'
export interface Host {
    @meta.id
    id: number
    @db.rel.from
    @ui.valueHelp Country, 'code'
    nav: Country[]
    @ui.valueHelp Country, 'code'
    @ui.valueHelp.distinct
    both: string
}`)
    ).join("\n");
    expect(m).toContain("not valid on a navigation field");
    expect(m).toContain("@ui.valueHelp cannot coexist with @ui.valueHelp.distinct");
  });
});

describe("@ui.valueHelp.distinct diagnostics", () => {
  it("DV1: only string / number", async () => {
    const m = await msgs(`
@db.table 'h'
export interface Host {
    @meta.id
    id: number
    @ui.valueHelp.distinct
    a: string
    @ui.valueHelp.distinct
    b: number
    @ui.valueHelp.distinct
    c: boolean
    @ui.valueHelp.distinct
    d: string[]
}`);
    expect(m.filter((x) => x.startsWith("E"))).toHaveLength(2);
    expect(m.join()).toContain("got boolean");
  });

  it("DV1: rejects number.timestamp (and aliases / extensions of it)", async () => {
    const m = await msgs(`
export type Stamp = number.timestamp
@db.table 'ts_host'
export interface Host {
    @meta.id
    id: number
    @ui.valueHelp.distinct
    plain: number
    @ui.valueHelp.distinct
    a: number.timestamp
    @ui.valueHelp.distinct
    b: Stamp
    @ui.valueHelp.distinct
    c: number.timestamp.created
    @ui.valueHelp.distinct
    d: number.int
}`);
    const errors = m.filter((x) => x.startsWith("E"));
    expect(errors).toHaveLength(3);
    expect(errors.join()).toContain("got timestamp");
  });

  it("DV2: not served by a db controller", async () => {
    const m = await msgs(`
export interface Host {
    @ui.valueHelp.distinct
    a: string
}`);
    expect(m.filter((x) => x.startsWith("W")).join()).toContain("served by a DB controller");
  });

  it("DV3: a table with only measures is strict too", async () => {
    const m = await msgs(`
@db.table 'agg2'
export interface Agg2 {
    @meta.id
    id: number
    @db.column.measure
    total: number
    @ui.valueHelp.distinct
    city: string
}`);
    expect(m.filter((x) => x.startsWith("W")).join()).toContain("not a dimension");
  });

  it("DV3: strict aggregate table", async () => {
    const m = await msgs(`
@db.table 'agg'
export interface Agg {
    @meta.id
    id: number
    @db.column.dimension
    region: string
    @ui.valueHelp.distinct
    city: string
    @ui.valueHelp.distinct
    @db.column.dimension
    ok: string
}`);
    const w = m.filter((x) => x.startsWith("W"));
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("not a dimension");
  });
});

describe("@ui.literalLabel diagnostics", () => {
  it("accepts labels on type, prop and arrays of unions", async () => {
    const m = await msgs(`
@ui.literalLabel 'open', 'Open'
@ui.literalLabel 'closed', 'Closed'
export type Ticket = 'open' | 'closed'
export interface Host {
    @ui.literalLabel '1', 'One'
    lvl: Level
    @ui.literalLabel 'open', 'Open'
    list: Status[]
}`);
    expect(m).toEqual([]);
  });

  it("LL1 / LL2 / LL3", async () => {
    const m = (
      await msgs(`
export interface Host {
    @ui.literalLabel 'x', 'X'
    plain: string
    @ui.literalLabel 'nope', 'Nope'
    s: Status
    @ui.literalLabel 'open', 'A'
    @ui.literalLabel 'open', 'B'
    t: Status
}`)
    ).join("\n");
    expect(m).toContain("requires a union of literal values");
    expect(m).toContain("'nope' is not one of the literals");
    expect(m).toContain("duplicate @ui.literalLabel for 'open'");
  });
});

describe("editor scopes", () => {
  it("scopes the field string and the filter by the sibling target", async () => {
    const { doc } = await compile(`
export interface Host {
    @ui.valueHelp AttributeValue, 'value', \`attribute = 'color'\`
    color: string
}`);
    const ann = doc.annotations.find((a) => a.name === "ui.valueHelp")!;
    expect(ann.args).toHaveLength(3);
    expect(getQueryScope(ann.args[1], doc)).toEqual({
      allowedTypes: [],
      unqualifiedTarget: "AttributeValue",
    });
    expect(getQueryScope(ann.args[2], doc)).toEqual({
      allowedTypes: ["AttributeValue"],
      unqualifiedTarget: "AttributeValue",
    });
    expect(typeof getFieldPathCompletionScope).toBe("function");
    const spec = doc.resolveAnnotation("ui.valueHelp")!;
    const refFilter = spec.arguments[0].refFilter!;
    const decl = (n: string) => doc.getDeclarationOwnerNode(n)!.node!;
    expect(refFilter(decl("Country"), doc)).toBe(true);
    expect(refFilter(decl("Status"), doc)).toBe(false);
    expect(refFilter(decl("CountryAlias"), doc)).toBe(false);
  });
});

describe("editor hover content", () => {
  it("documents each annotation and every one of its arguments", async () => {
    const { doc } = await compile("export interface Host { a: string }");
    for (const name of ["ui.valueHelp", "ui.valueHelp.distinct", "ui.literalLabel"]) {
      const spec = doc.resolveAnnotation(name)!;
      expect(spec, name).toBeDefined();
      expect(spec.config.description, `${name} description`).toBeTruthy();
      for (const arg of spec.arguments) {
        expect(arg.description, `${name} argument '${arg.name}'`).toBeTruthy();
      }
    }
    // labels accumulate across a ref (the referenced type's, then the prop's own)
    expect(doc.resolveAnnotation("ui.literalLabel")!.config.mergeStrategy).toBe("append");
    expect(doc.resolveAnnotation("ui.valueHelp")!.arguments).toHaveLength(3);
    expect(doc.resolveAnnotation("ui.literalLabel")!.arguments).toHaveLength(2);
  });
});

describe("editor features on the real annotations", () => {
  /** Line / character of `shift` characters into the first occurrence of `needle`. */
  const pos = (text: string, needle: string, shift = 0) => {
    const offset = text.indexOf(needle);
    expect(offset, needle).toBeGreaterThanOrEqual(0);
    const before = text.slice(0, offset + shift).split("\n");
    return { line: before.length - 1, character: before.at(-1)!.length };
  };

  const SOURCE = `
export interface Host {
    @ui.valueHelp AttributeValue, 'value', \`attribute = 'color'\`
    color: string
    @ui.literalLabel 'shipped', 'Done'
    status: 'new' | 'shipped'
    @ui.literalLabel 'closed', 'WIP'
    typed: Status
}`;

  it("@ui.valueHelp: go-to-definition on the target and on the field", async () => {
    const { doc, text } = await compile(SOURCE);
    const target = pos(text, "AttributeValue, 'value'", 3);
    const toTarget = doc.getToDefinitionAt(target.line, target.character)!;
    expect(toTarget[0].targetUri).toBe(doc.id);
    expect(toTarget[0].targetSelectionRange.start.line).toBe(
      pos(text, "export interface AttributeValue").line,
    );

    const field = pos(text, "'value', `attribute", 3);
    const toField = doc.getToDefinitionAt(field.line, field.character)!;
    expect(toField[0].targetSelectionRange.start.line).toBe(pos(text, "    value: string").line);
  });

  it("@ui.valueHelp: the field string hovers as a property of the target; the filter completes its fields", async () => {
    const { doc, text } = await compile(SOURCE);
    const field = pos(text, "'value', `attribute", 3);
    const ref = resolveFieldRefAt(
      doc.tokensIndex.at(field.line, field.character)!,
      doc,
      field.character,
    );
    expect(ref?.typeName).toBe("AttributeValue");
    expect(ref?.prop.token("identifier")?.text).toBe("value");

    const ann = doc.annotations.find((a) => a.name === "ui.valueHelp")!;
    const scope = getFieldPathCompletionScope(
      ann.args[1],
      doc,
      ann.args[1].range.start.character + 2,
    );
    expect(scope?.typeName).toBe("AttributeValue");
    expect(scope?.fields.map((f) => f.token("identifier")?.text)).toEqual(
      expect.arrayContaining(["attribute", "value", "label", "active"]),
    );
  });

  it("@ui.literalLabel: offers the literals of the union (direct and through an alias)", async () => {
    const { doc } = await compile(SOURCE);
    const [direct, through] = doc.annotations.filter((a) => a.name === "ui.literalLabel");
    const values = (a: typeof direct) => getValueCandidates(a.token, 0, doc)?.map((c) => c.value);
    expect(values(direct)).toEqual(["new", "shipped"]);
    expect(values(through)).toEqual(["open", "closed"]);
    // the label argument has no value scope
    expect(getValueCandidates(direct.token, 1, doc)).toBeUndefined();
  });

  it("@ui.literalLabel: no candidates when the host is not a union", async () => {
    const { doc } = await compile(`
export interface Plain2 {
    @ui.literalLabel 'x', 'X'
    note: string
}`);
    const ann = doc.annotations.filter((a) => a.name === "ui.literalLabel").at(-1)!;
    expect(getValueCandidates(ann.token, 0, doc)).toBeUndefined();
  });

  it("@ui.literalLabel: go-to-definition on the value jumps to the literal", async () => {
    const { doc, text } = await compile(SOURCE);
    const value = pos(text, "'shipped', 'Done'", 3);
    const result = doc.getToDefinitionAt(value.line, value.character)!;
    expect(result[0].targetUri).toBe(doc.id);
    const literal = pos(text, "'new' | 'shipped'", "'new' | ".length);
    expect(result[0].targetSelectionRange.start).toEqual(literal);

    // through a type alias: lands on the literal in the alias declaration
    const aliased = pos(text, "'closed', 'WIP'", 3);
    const viaAlias = doc.getToDefinitionAt(aliased.line, aliased.character)!;
    expect(viaAlias[0].targetSelectionRange.start.line).toBe(pos(text, "export type Status").line);
  });
});

describe("annotate blocks (the same hooks as inline annotations)", () => {
  const pos = (text: string, needle: string, shift = 0) => {
    const offset = text.indexOf(needle);
    expect(offset, needle).toBeGreaterThanOrEqual(0);
    const before = text.slice(0, offset + shift).split("\n");
    return { line: before.length - 1, character: before.at(-1)!.length };
  };

  it("a valid @ui.valueHelp in an annotate entry raises no error (target is a type, not a property)", async () => {
    const { messages } = await compile(`
export interface Host {
    country: string
    rank: number
}
annotate Host {
    @ui.valueHelp Country, 'code'
    country
    @ui.valueHelp Rank, 'level', \`level > 1\`
    rank
}`);
    expect(messages).toEqual([]);
  });

  it("VH1-VH3 run on the entry: bad target, missing field, host type mismatch", async () => {
    const m = (
      await msgs(`
export interface Host {
    a: string
    b: string
    c: number
}
annotate Host {
    @ui.valueHelp CountryAlias, 'code'
    a
    @ui.valueHelp Country, 'nope'
    b
    @ui.valueHelp Country, 'code'
    c
}`)
    ).join("\n");
    expect(m).toContain("CountryAlias");
    expect(m).toContain("Field 'nope' does not exist on 'Country'");
    expect(m).toContain("is string, 'c' is number");
    expect(m).not.toContain("Unknown property");
  });

  it("@ui.valueHelp in an annotate entry: go-to-definition and field-scope on the target", async () => {
    const { doc, text } = await compile(`
export interface Host {
    country: string
}
annotate Host {
    @ui.valueHelp Country, 'code'
    country
}`);
    const target = pos(text, "Country, 'code'", 3);
    const toTarget = doc.getToDefinitionAt(target.line, target.character)!;
    expect(toTarget[0].targetSelectionRange.start.line).toBe(
      pos(text, "export interface Country").line,
    );
    const ann = doc.annotations.find((a) => a.name === "ui.valueHelp" && a.args.length)!;
    expect(getQueryScope(ann.args[1], doc)).toEqual({
      allowedTypes: [],
      unqualifiedTarget: "Country",
    });
  });

  it("DV1 runs in an annotate entry (string/number only, timestamp rejected)", async () => {
    const m = await msgs(`
@db.table 'an_host'
export interface Host {
    @meta.id
    id: number
    flag: boolean
    at: number.timestamp
    ok: string
}
annotate Host {
    @ui.valueHelp.distinct
    flag
    @ui.valueHelp.distinct
    at
    @ui.valueHelp.distinct
    ok
}`);
    const errors = m.filter((x) => x.startsWith("E"));
    expect(errors.join()).toContain("got boolean");
    expect(errors.join()).toContain("got timestamp");
    expect(errors).toHaveLength(2);
  });

  it("DV1 detects timestamps by tag: aliases, extensions and unions with null", async () => {
    const m = await msgs(`
export type Stamp = number.timestamp
@db.table 'tag_host'
export interface Host {
    @meta.id
    id: number
    @ui.valueHelp.distinct
    a: Stamp
    @ui.valueHelp.distinct
    b: number.timestamp.updated
    @ui.valueHelp.distinct
    c: Stamp | null
    @ui.valueHelp.distinct
    d: number
}`);
    expect(m.filter((x) => x.startsWith("E"))).toHaveLength(3);
  });

  it("DV2 judges the annotated target's owner: non-db target warns, db target does not", async () => {
    const m = await msgs(`
export interface Plain2 {
    ok: string
}
annotate Plain2 {
    @ui.valueHelp.distinct
    ok
}
@db.table 'dv2_host'
export interface DbHost {
    @meta.id
    id: number
    ok: string
}
annotate DbHost {
    @ui.valueHelp.distinct
    ok
}`);
    const w = m.filter((x) => x.includes("served by a DB controller"));
    expect(w).toHaveLength(1);
  });

  it("DV3 judges the target prop of a strict aggregate table", async () => {
    const m = await msgs(`
@db.table 'agg_host'
@db.table.aggregate 'strict'
export interface AggHost {
    @db.column.dimension
    dim: string
    other: string
}
annotate AggHost {
    @ui.valueHelp.distinct
    dim
    @ui.valueHelp.distinct
    other
}`);
    const w = m.filter((x) => x.includes("$groupBy rejects"));
    expect(w).toHaveLength(1);
  });

  it("N2: null / undefined members do not make a nullable field 'other' (VH3, DV1)", async () => {
    const m = await msgs(`
@db.table 'nullable_host'
export interface NullableHost {
    @meta.id
    id: number
    @ui.valueHelp Country, 'code'
    a: string | null
    @ui.valueHelp.distinct
    f: string | null
    @ui.valueHelp.distinct
    g?: number | undefined
    @ui.valueHelp.distinct
    h: boolean | null
}`);
    const errors = m.filter((x) => x.startsWith("E"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("got boolean");
  });

  it("N4: DV2 / DV3 resolve the owning table of a nested field", async () => {
    const m = await msgs(`
@db.table 'nested_host'
export interface NestedHost {
    @meta.id
    id: number
    addr: {
        @ui.valueHelp.distinct
        city: string
    }
}
export interface NestedPlain {
    addr: {
        @ui.valueHelp.distinct
        city: string
    }
}
@db.table 'nested_agg'
export interface NestedAgg {
    @db.column.dimension
    dim: string
    addr: {
        @ui.valueHelp.distinct
        city: string
        @ui.valueHelp.distinct
        @db.column.dimension
        zip: string
    }
}
annotate NestedHost {
    @ui.valueHelp.distinct
    addr.city
}`);
    const dv2 = m.filter((x) => x.includes("served by a DB controller"));
    expect(dv2).toHaveLength(1); // NestedPlain only
    const dv3 = m.filter((x) => x.includes("$groupBy rejects"));
    expect(dv3).toHaveLength(1); // NestedAgg.addr.city
  });

  it("VH8 reads the target prop's navigation, not the entry's", async () => {
    const m = await msgs(`
@db.table 'nav_owner'
export interface NavOwner {
    @meta.id
    id: string
}
@db.table 'nav_host'
export interface NavHost {
    @meta.id
    id: string
    ownerId: string
    @db.rel.to
    owner: NavOwner
}
annotate NavHost {
    @ui.valueHelp Country, 'code'
    owner
}`);
    expect(m.join("\n")).toContain("not valid on a navigation field");
  });

  it("VH3 names the full entry path of a nested entry", async () => {
    const m = await msgs(`
export interface NestHost {
    addr: { country: number }
}
annotate NestHost {
    @ui.valueHelp Country, 'code'
    addr.country
}`);
    expect(m.join("\n")).toContain("'addr.country' is number");
    expect(m.join("\n")).not.toContain("'addr' is");
  });

  it("@ui.literalLabel: LL1-LL3 and candidates work in an annotate entry", async () => {
    const { doc, messages, text } = await compile(`
export interface Host {
    status: 'new' | 'shipped'
    note: string
}
annotate Host {
    @ui.literalLabel 'shipped', 'Done'
    @ui.literalLabel 'nope', 'X'
    status
    @ui.literalLabel 'x', 'X'
    note
}`);
    const m = messages.join("\n");
    expect(m).toContain("'nope' is not one of the literals");
    expect(m).toContain("requires a union of literal values");
    const anns = doc.annotations.filter((a) => a.name === "ui.literalLabel");
    expect(getValueCandidates(anns[0].token, 0, doc)?.map((c) => c.value)).toEqual([
      "new",
      "shipped",
    ]);
    const value = pos(text, "'shipped', 'Done'", 3);
    const result = doc.getToDefinitionAt(value.line, value.character)!;
    expect(result[0].targetSelectionRange.start).toEqual(
      pos(text, "'new' | 'shipped'", "'new' | ".length),
    );
  });

  it("@ui.literalLabel merges with the type's labels (append: the prop's label wins per literal)", async () => {
    const { doc } = await compile(`
@ui.literalLabel 'open', 'Open'
@ui.literalLabel 'closed', 'Closed'
export type Lifecycle = 'open' | 'closed'
export interface Host {
    @ui.literalLabel 'open', 'Opened'
    status: Lifecycle
}`);
    expect(doc.resolveAnnotation("ui.literalLabel")!.config.mergeStrategy).toBe("append");
    expect(doc.resolveAnnotation("ui.literalLabel")!.config.description).not.toMatch(/replac/i);
  });
});
