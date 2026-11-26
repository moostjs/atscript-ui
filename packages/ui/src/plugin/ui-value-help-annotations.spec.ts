import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyzeQueryCursorContext,
  build,
  getDeclaredValue,
  getFieldPathCompletionScope,
  getQueryCompletionScope,
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

@db.table 'cities'
@db.http.path '/cities'
export interface City {
    @meta.id
    country: string
    @meta.id
    code: string
    @ui.dict.label
    name: string
    population: number
    active: boolean
    info: { a: string }
}
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
    // on a field, a right-hand field reference is a host reference (since 0.1.190)
    expect(m).toContain(
      "a value-help filter compares target fields with literal values, or with a field of the host: 'Host.value'",
    );
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

  it("DV3: a dimension the table inherits makes it strict", async () => {
    const m = await msgs(`
export interface AggBase {
    @meta.id
    id: number
    @db.column.dimension
    region: string
}
@db.table 'agg3'
export interface Agg3 extends AggBase {
    @ui.valueHelp.distinct
    city: string
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

describe("@ui.literalLabel on booleans", () => {
  it("accepts 'true' / 'false' on boolean, optional, nullable, array and aliased hosts", async () => {
    const m = await msgs(`
@ui.literalLabel 'true', 'On'
export type Flag = boolean
export interface BoolHost {
    @ui.literalLabel 'true', 'Active'
    @ui.literalLabel 'false', 'Inactive'
    active: boolean
    @ui.literalLabel 'true', 'Yes please'
    opt?: boolean
    @ui.literalLabel 'false', 'Not set yet'
    maybe: boolean | null
    @ui.literalLabel 'true', 'On'
    flags: boolean[]
    @ui.literalLabel 'false', 'Off'
    aliased: Flag
    @ui.literalLabel 'open', 'Opened'
    status: 'open' | 'closed' | null
}`);
    expect(m).toEqual([]);
  });

  it("any other value on a boolean is an error naming the two values", async () => {
    const m = await msgs(`
export interface BoolBad {
    @ui.literalLabel 'yes', 'Yes'
    active: boolean
    @ui.literalLabel 'TRUE', 'Yes'
    maybe: boolean | null
    @ui.literalLabel 'true', 'A'
    @ui.literalLabel 'true', 'B'
    dup: boolean
}`);
    expect(m).toContain("E: 'yes' is not one of the literals: 'true', 'false'");
    expect(m).toContain("E: 'TRUE' is not one of the literals: 'true', 'false'");
    expect(m).toContain("E: duplicate @ui.literalLabel for 'true'");
  });

  it("a host of another kind is still rejected (LL1)", async () => {
    const m = (
      await msgs(`
export interface BoolMixed {
    @ui.literalLabel 'true', 'Yes'
    n: number | null
    @ui.literalLabel 'x', 'X'
    s: string
}`)
    ).filter((x) => x.includes("requires a union of literal values or a boolean"));
    expect(m).toHaveLength(2);
  });

  it("the value scope offers 'true' / 'false' for a boolean host", async () => {
    const { doc } = await compile(`
export interface BoolScope {
    @ui.literalLabel 'true', 'Active'
    active: boolean
    @ui.literalLabel 'false', 'Off'
    maybe?: boolean | null
    @ui.literalLabel 'true', 'On'
    flags: boolean[]
}`);
    const anns = doc.annotations.filter((a) => a.name === "ui.literalLabel");
    for (const ann of anns.slice(-3)) {
      expect(getValueCandidates(ann.token, 0, doc)?.map((c) => c.value)).toEqual(["true", "false"]);
    }
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
    // the host interface is in scope too: a right-hand `Host.field` is a host reference
    expect(getQueryScope(ann.args[2], doc)).toEqual({
      allowedTypes: ["AttributeValue", "Host"],
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
    for (const name of [
      "ui.valueHelp",
      "ui.valueHelp.distinct",
      "ui.valueHelp.fill",
      "ui.valueHelp.column",
      "ui.literalLabel",
      "ui.valueLabel",
    ]) {
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
    // fills and columns: repeatable, a referring prop's list replaces; fills stay home
    const fill = doc.resolveAnnotation("ui.valueHelp.fill")!;
    expect(fill.arguments.map((a) => a.name)).toEqual(["local", "targetField"]);
    expect(fill.config).toMatchObject({
      nodeType: ["prop"],
      multiple: true,
      mergeStrategy: "replace",
      passedWhenReferred: false,
    });
    const column = doc.resolveAnnotation("ui.valueHelp.column")!;
    expect(column.arguments.map((a) => a.name)).toEqual(["field"]);
    expect(column.config).toMatchObject({
      nodeType: ["prop"],
      multiple: true,
      mergeStrategy: "replace",
    });
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

describe("@ui.form.type 'tags' diagnostics", () => {
  it("is accepted on arrays (also through a type alias)", async () => {
    const m = await msgs(`
export type Words = string[]
export interface TagsOk {
    @ui.form.type 'tags'
    a: string[]

    @ui.form.type 'tags'
    b?: Words

    @ui.form.type 'textarea'
    c: string
}`);
    expect(m.filter((x) => x.includes("tags"))).toEqual([]);
  });

  it("is rejected on a non-array field", async () => {
    const m = await msgs(`
export interface TagsBad {
    @ui.form.type 'tags'
    a: string

    @ui.form.type 'tags'
    b: { x: string }
}`);
    expect(m).toContain("E: 'tags' requires an array field (e.g. string[]), got string");
    expect(m).toContain("E: 'tags' requires an array field (e.g. string[]), got object");
  });
});

// ── Since 0.1.190: host references, fills, columns ─────────

/** Line / character of `shift` characters into the first occurrence of `needle` after `from`. */
function at(text: string, needle: string, shift = 0, from?: string) {
  const start = from === undefined ? 0 : text.indexOf(from);
  const offset = text.indexOf(needle, start);
  expect(offset, needle).toBeGreaterThanOrEqual(0);
  const before = text.slice(0, offset + shift).split("\n");
  return { line: before.length - 1, character: before.at(-1)!.length };
}

const errorsOf = (m: string[]) => m.filter((x) => x.startsWith("E"));

describe("host references in the binding filter (VH9)", () => {
  it("accepts `targetField = Host.field` conjuncts: declared, inherited, mixed with literals", async () => {
    const m = await msgs(`
export interface CustomerBase {
    region: string
}
export interface Customer extends CustomerBase {
    country: string
    @ui.valueHelp City, 'code', \`country = Customer.country and active = true\`
    @ui.valueHelp.fill 'country', 'country'
    city?: string
    @ui.valueHelp City, 'code', \`country = Customer.region\`
    @ui.valueHelp.fill 'region', 'country'
    other?: string
}`);
    // (the fills write the key member back: no repeating-values warning, VH6)
    expect(m).toEqual([]);
  });

  it("a host reference pins a composite-key member only with a fill writing it back (VH6)", async () => {
    const m = await msgs(`
export interface Customer {
    country: string
    @ui.valueHelp City, 'code', \`country = Customer.country\`
    @ui.valueHelp.fill 'country', 'country'
    city?: string
    @ui.valueHelp City, 'code', \`country = Customer.country\`
    hostOnly?: string
    @ui.valueHelp City, 'code', \`country = Customer.country\`
    @ui.valueHelp.fill 'country', 'name'
    elsewhere?: string
    @ui.valueHelp City, 'code'
    unpinned?: string
}`);
    // pinned only while the host field has a value: an empty one lists every country's codes
    const repeat = m.filter((x) => x.includes("values may repeat"));
    expect(repeat).toHaveLength(3);
    expect(repeat[0]).toContain("or to a host field a fill writes back from the picked row");
  });

  it("a dictionary bound from its own interface: the right-hand side is the host", async () => {
    const m = await msgs(`
@db.table 'employees'
@db.http.path '/employees'
export interface Employee {
    @meta.id
    id: string
    dept: string
    @ui.valueHelp Employee, 'id', \`dept = Employee.dept\`
    manager?: string
}`);
    expect(m).toEqual([]);
  });

  it("refuses every other use of the host", async () => {
    const m = (
      await msgs(`
export interface Customer {
    country: string
    pop: number
    addr: { zip: string }
    tags: string[]
    @db.json
    raw: string
    @ui.valueHelp City, 'code', \`country = Customer.country or active = true\`
    a?: string
    @ui.valueHelp City, 'code', \`not (country = Customer.country)\`
    b?: string
    @ui.valueHelp City, 'code', \`country != Customer.country\`
    c?: string
    @ui.valueHelp City, 'code', \`Customer.country = 'x'\`
    d?: string
    @ui.valueHelp City, 'code', \`country = name\`
    e?: string
    @ui.valueHelp City, 'code', \`country = Customer.nope\`
    f?: string
    @ui.valueHelp City, 'code', \`country = Customer.g\`
    g?: string
    @ui.valueHelp City, 'code', \`country = Customer.addr\`
    h?: string
    @ui.valueHelp City, 'code', \`country = Customer.raw\`
    i?: string
    @ui.valueHelp City, 'code', \`population = Customer.country\`
    j?: string
    @ui.valueHelp City, 'code', \`country = Customer.addr.zip\`
    k?: string
}`)
    ).join("\n");
    expect(m).toContain("must be a top-level 'and' conjunct of the filter");
    expect(m).toContain("a host reference compares with '=' (got '!=')");
    expect(m).toContain("the left side names a field of 'City'");
    expect(m).toContain("or with a field of the host: 'Customer.name'");
    expect(m).toContain("Field 'nope' does not exist on 'Customer'");
    expect(m).toContain("cannot name the bound field itself");
    expect(m).toContain("host field 'Customer.addr' must be a scalar");
    expect(m).toContain("host field 'Customer.raw' must be a scalar");
    expect(m).toContain("'City.population' is number, 'Customer.country' is string");
    expect(m).toContain("names a top-level field of 'Customer', not a dotted path");
    // under `or` AND under `not`
    expect(m.match(/top-level 'and' conjunct/g)).toHaveLength(2);
  });

  it("a field of an inline structure, an `as` copy and a type-level binding take no host references", async () => {
    const m = (
      await msgs(`
export interface Customer {
    country: string
    addr: {
        @ui.valueHelp City, 'code', \`country = Customer.country\`
        city: string
    }
}
@ui.valueHelp City, 'code', \`country = Customer.country\`
export type CityCode = string
export interface Plain2 {
    country: string
    city?: string
}
annotate Plain2 as Plain2Copy {
    @ui.valueHelp City, 'code', \`country = Plain2.country\`
    city
}`)
    ).join("\n");
    expect(m).toContain(
      "a host reference (a right-hand field reference) needs a top-level field of an interface",
    );
    expect(m).toContain("not of an `annotate … as` copy");
    expect(m).toContain("a value-help filter compares target fields with literal values");
  });

  it("works in an annotate entry, the host field named by the annotated interface", async () => {
    const m = await msgs(`
export interface Customer {
    country: string
    other: string
    city?: string
    note?: string
}
annotate Customer {
    @ui.valueHelp City, 'code', \`country = Customer.country\`
    city
    @ui.valueHelp City, 'code', \`country = Customer.other or active = true\`
    note
}`);
    expect(errorsOf(m)).toHaveLength(1);
    expect(m.join()).toContain("top-level 'and' conjunct");
  });

  it("an annotate entry resolves a field the interface only inherits (generated table interfaces)", async () => {
    const m = await msgs(`
export interface Row {
    country: string
    city?: string
    cityName?: string
}
export interface RowTable extends Row {}
annotate RowTable {
    @ui.valueHelp City, 'code', \`country = RowTable.country\`
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.fill 'country', 'country'
    city
}`);
    expect(m).toEqual([]);
  });

  it("VH7: a manual-filterable dictionary checks the left-hand fields only", async () => {
    const m = await msgs(`
export interface Host {
    kind: string
    other: string
    @ui.valueHelp ManualDict, 'id', \`kind = Host.kind and other = Host.other\`
    a?: string
}`);
    const w = m.filter((x) => x.startsWith("W"));
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("'other' needs @db.column.filterable");
  });
});

describe("@ui.valueHelp.fill diagnostics", () => {
  it("accepts fills from the field's own binding and from its FK help", async () => {
    const m = await msgs(`
export interface Customer {
    country: string
    @ui.valueHelp City, 'code', \`country = Customer.country\`
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.fill 'country', 'country'
    city?: string
    cityName?: string
    @db.rel.FK
    @ui.valueHelp.fill 'countryName', 'name'
    countryCode?: Country.code
    countryName?: string
}`);
    expect(m).toEqual([]);
  });

  it("FL1: a field without a binding of its own", async () => {
    const m = await msgs(`
export interface Base {
    @ui.valueHelp City, 'code'
    city?: string
}
export interface View {
    @ui.valueHelp.fill 'cityName', 'name'
    city?: Base.city
    cityName?: string
    @ui.valueHelp.fill 'cityName', 'name'
    plain?: string
}`);
    expect(m.filter((x) => x.includes("needs a binding of this field's own"))).toHaveLength(2);
  });

  it("FL2-FL4: the sibling and the target field", async () => {
    const m = (
      await msgs(`
export interface Customer {
    pop: number
    addr: { zip: string }
    @ui.valueHelp City, 'code'
    @ui.valueHelp.fill 'nope', 'name'
    @ui.valueHelp.fill 'addr.zip', 'name'
    @ui.valueHelp.fill 'city', 'name'
    @ui.valueHelp.fill 'addr', 'name'
    @ui.valueHelp.fill 'cityName', 'missing'
    @ui.valueHelp.fill 'cityName', 'info.a'
    @ui.valueHelp.fill 'cityName', 'info'
    @ui.valueHelp.fill 'pop', 'name'
    city?: string
    cityName?: string
}`)
    ).join("\n");
    expect(m).toContain("Field 'nope' does not exist on 'Customer'");
    expect(m).toContain("'addr.zip' must be a top-level field of 'Customer', not a dotted path");
    expect(m).toContain("cannot fill the bound field itself");
    expect(m).toContain("'Customer.addr' must be a scalar");
    expect(m).toContain("Field 'missing' does not exist on 'City'");
    expect(m).toContain("'info.a' must be a top-level field of 'City', not a dotted path");
    expect(m).toContain("'City.info' must be a scalar");
    expect(m).toContain("'City.name' is string, 'Customer.pop' is number");
  });

  it("FL5: a derived, read-only or navigation sibling warns (the write is skipped)", async () => {
    const m = await msgs(`
@db.table 'fl5_orders'
export interface Order {
    @meta.id
    id: number
    @db.rel.FK
    countryCode: Country.code
    @db.rel.to
    country?: Country
    @meta.readonly
    shown?: string
    @ui.valueHelp City, 'code'
    @ui.valueHelp.fill 'shown', 'name'
    @ui.valueHelp.fill 'country', 'name'
    city?: string
}`);
    const w = m.filter((x) => x.startsWith("W"));
    expect(w.join("\n")).toContain("'shown' is @meta.readonly");
    expect(w.join("\n")).toContain("'country' is a navigation field");
    expect(errorsOf(m)).toEqual([]);
  });

  it("refused on a field of an inline structure and in an `as` copy", async () => {
    const m = (
      await msgs(`
export interface Customer {
    addr: {
        @ui.valueHelp City, 'code'
        @ui.valueHelp.fill 'name', 'name'
        city: string
        name: string
    }
}
export interface Plain2 {
    city?: string
    cityName?: string
}
annotate Plain2 as Plain2Copy {
    @ui.valueHelp City, 'code'
    @ui.valueHelp.fill 'cityName', 'name'
    city
}`)
    ).join("\n");
    expect(m).toContain("@ui.valueHelp.fill needs a top-level field of an interface");
    expect(m).toContain(
      "@ui.valueHelp.fill needs a field of an interface or of a mutating annotate block",
    );
  });

  it("runs in an annotate entry, against the landed binding", async () => {
    const m = (
      await msgs(`
export interface Customer {
    @ui.valueHelp City, 'code'
    city?: string
    cityName?: string
    pop?: number
}
annotate Customer {
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.fill 'pop', 'name'
    city
}`)
    ).join("\n");
    expect(m).toContain("'City.name' is string, 'Customer.pop' is number");
    expect(m).not.toContain("needs a binding");
  });

  it("an annotate entry replacing the binding re-checks the field's fills and columns", async () => {
    const m = (
      await msgs(`
export interface Customer {
    @ui.valueHelp City, 'code'
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.column 'population'
    city?: string
    cityName?: string
}
annotate Customer {
    @ui.valueHelp Country, 'code'
    city
}`)
    ).join("\n");
    expect(m).toContain(
      "@ui.valueHelp.column 'population' of this field: Field 'population' does not exist on 'Country'",
    );
    expect(m).not.toContain("@ui.valueHelp.fill 'cityName', 'name' of this field");
  });
});

describe("@ui.valueHelp.column diagnostics", () => {
  it("CL1 / CL2", async () => {
    const m = (
      await msgs(`
export interface Customer {
    @ui.valueHelp City, 'code'
    @ui.valueHelp.column 'code'
    @ui.valueHelp.column 'name'
    @ui.valueHelp.column 'nope'
    @ui.valueHelp.column 'info'
    city?: string
    @ui.valueHelp.column 'name'
    plain?: string
}`)
    ).join("\n");
    expect(m).toContain("Field 'nope' does not exist on 'City'");
    expect(m).toContain("'City.info' must be a scalar");
    expect(m).toContain("@ui.valueHelp.column needs a binding of this field's own");
    expect(m.split("\n").filter((x) => x.startsWith("E"))).toHaveLength(3);
  });

  it("accepted inside an inline structure and in an annotate entry", async () => {
    const m = await msgs(`
export interface Customer {
    addr: {
        @ui.valueHelp Country, 'code'
        @ui.valueHelp.column 'name'
        country: string
    }
    country?: string
}
annotate Customer {
    @ui.valueHelp Country, 'code'
    @ui.valueHelp.column 'name'
    country
}`);
    expect(m).toEqual([]);
  });
});

describe("editor features of host references, fills and columns", () => {
  const INLINE = `
export interface Customer {
    country: string
    @ui.valueHelp City, 'code', \`country = Customer.country\`
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.column 'population'
    city?: string
    cityName?: string
}`;
  const ANNOTATED = `
export interface Customer {
    country: string
    city?: string
    cityName?: string
}
annotate Customer {
    @ui.valueHelp City, 'code', \`country = Customer.country\`
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.column 'population'
    city
}`;

  for (const [where, source] of [
    ["inline", INLINE],
    ["in an annotate entry", ANNOTATED],
  ] as const) {
    describe(where, () => {
      it("the filter offers the host after an operator and its fields after `Host.`", async () => {
        const { doc } = await compile(source);
        const ann = doc.annotations.find((a) => a.name === "ui.valueHelp" && a.args.length === 3)!;
        const scope = getQueryCompletionScope(ann.args[2], doc)!;
        expect(scope.typeNames).toEqual(["City", "Customer"]);
        expect(scope.unqualifiedTarget).toBe("City");
        expect(analyzeQueryCursorContext("country = ", "query").type).toBe("after-operator");
        expect(analyzeQueryCursorContext("country = Customer.", "query")).toMatchObject({
          type: "after-dot",
          typeName: "Customer",
        });
        expect(scope.getFields("Customer").map((f) => f.token("identifier")?.text)).toEqual(
          expect.arrayContaining(["country", "cityName"]),
        );
      });

      it("go-to-definition and hover on the host field of the filter", async () => {
        const { doc, text } = await compile(source);
        const ref = at(text, "Customer.country`", "Customer.".length + 2, "@ui.valueHelp City");
        const result = doc.getToDefinitionAt(ref.line, ref.character)!;
        expect(result[0].targetSelectionRange.start.line).toBe(
          at(text, "country: string", 0, "export interface Customer").line,
        );
        const hover = resolveFieldRefAt(doc.tokensIndex.at(ref.line, ref.character)!, doc);
        expect(hover?.typeName).toBe("Customer");
        expect(hover?.prop.token("identifier")?.text).toBe("country");
      });

      it("fill: `local` completes and resolves to the host's field, `targetField` to the target's", async () => {
        const { doc, text } = await compile(source);
        const fill = doc.annotations.find((a) => a.name === "ui.valueHelp.fill")!;
        expect(getQueryScope(fill.args[0], doc)).toEqual({
          allowedTypes: [],
          unqualifiedTarget: "Customer",
        });
        expect(getQueryScope(fill.args[1], doc)).toEqual({
          allowedTypes: [],
          unqualifiedTarget: "City",
        });
        // indexed for find-references and rename of the fields they name
        expect(doc.fieldPathArgs).toEqual(expect.arrayContaining([fill.args[0], fill.args[1]]));
        const locals = getFieldPathCompletionScope(
          fill.args[0],
          doc,
          fill.args[0].range.start.character + 2,
        );
        expect(locals?.typeName).toBe("Customer");
        expect(locals?.fields.map((f) => f.token("identifier")?.text)).toEqual(
          expect.arrayContaining(["country", "cityName"]),
        );
        const targets = getFieldPathCompletionScope(
          fill.args[1],
          doc,
          fill.args[1].range.start.character + 2,
        );
        expect(targets?.typeName).toBe("City");
        expect(targets?.fields.map((f) => f.token("identifier")?.text)).toEqual(
          expect.arrayContaining(["name", "population"]),
        );

        const local = at(text, "'cityName', 'name'", 3);
        expect(
          doc.getToDefinitionAt(local.line, local.character)![0].targetSelectionRange.start.line,
        ).toBe(at(text, "cityName?: string").line);
        const hover = resolveFieldRefAt(
          doc.tokensIndex.at(local.line, local.character)!,
          doc,
          local.character,
        );
        expect(hover?.typeName).toBe("Customer");
        expect(hover?.prop.token("identifier")?.text).toBe("cityName");
        // hover on `targetField`: the dictionary's field
        const target = at(text, "'name'", 3, "@ui.valueHelp.fill");
        const onTarget = resolveFieldRefAt(
          doc.tokensIndex.at(target.line, target.character)!,
          doc,
          target.character,
        );
        expect(onTarget?.typeName).toBe("City");
        expect(onTarget?.prop.token("identifier")?.text).toBe("name");
      });

      it("column: completes and hovers as the binding target's field", async () => {
        const { doc, text } = await compile(source);
        const column = doc.annotations.find((a) => a.name === "ui.valueHelp.column")!;
        const scope = getFieldPathCompletionScope(
          column.args[0],
          doc,
          column.args[0].range.start.character + 2,
        );
        expect(scope?.typeName).toBe("City");
        const pos = at(text, "'population'", 3);
        const hover = resolveFieldRefAt(
          doc.tokensIndex.at(pos.line, pos.character)!,
          doc,
          pos.character,
        );
        expect(hover?.typeName).toBe("City");
        expect(hover?.prop.token("identifier")?.text).toBe("population");
      });

      it("go-to-definition on the dictionary field of a fill and of a column", async () => {
        const { doc, text } = await compile(source);
        const target = at(text, "'name'", 3, "@ui.valueHelp.fill");
        expect(
          doc.getToDefinitionAt(target.line, target.character)![0].targetSelectionRange.start.line,
        ).toBe(at(text, "name: string", 0, "export interface City").line);
        const pos = at(text, "'population'", 3);
        expect(
          doc.getToDefinitionAt(pos.line, pos.character)![0].targetSelectionRange.start.line,
        ).toBe(at(text, "population: number").line);
      });
    });
  }

  it("the target of a fill or column follows the field's FK help", async () => {
    const { doc } = await compile(`
export interface Order {
    @db.rel.FK
    @ui.valueHelp.fill 'countryName', 'name'
    @ui.valueHelp.column 'name'
    countryCode?: Country.code
    countryName?: string
}`);
    const fill = doc.annotations.find((a) => a.name === "ui.valueHelp.fill")!;
    expect(getQueryScope(fill.args[1], doc)?.unqualifiedTarget).toBe("Country");
    const column = doc.annotations.find((a) => a.name === "ui.valueHelp.column")!;
    expect(getQueryScope(column.args[0], doc)?.unqualifiedTarget).toBe("Country");
  });
});

// ── Since 0.1.190: @ui.valueLabel ──────────────────────────

describe("@ui.valueLabel diagnostics", () => {
  it("accepts a string sibling, declared or inherited, with or without an arrangement", async () => {
    const m = await msgs(`
export interface BaseOffice {
    regionName?: string
}
export interface Office extends BaseOffice {
    @ui.valueLabel 'cityName'
    city?: string
    cityName?: string | null
    @ui.valueLabel 'regionName', 'keyText'
    region?: string
    @ui.valueLabel 'statusText', 'text'
    status?: number
    statusText?: 'open' | 'closed'
}`);
    expect(m).toEqual([]);
  });

  it("VL1: a missing, number or dotted sibling, or the field itself", async () => {
    const m = (
      await msgs(`
export interface Office {
    headcount: number
    nested: { a: string }
    @ui.valueLabel 'nope'
    a?: string
    @ui.valueLabel 'headcount'
    b?: string
    @ui.valueLabel 'nested.a'
    c?: string
    @ui.valueLabel 'd'
    d?: string
}`)
    ).join("\n");
    expect(m).toContain("@ui.valueLabel 'nope': no sibling field named 'nope' on this type");
    expect(m).toContain("@ui.valueLabel 'headcount': sibling field must be a string, got 'number'");
    expect(m).toContain("@ui.valueLabel 'nested.a': no sibling field named 'nested.a'");
    expect(m).toContain("names the field holding this value's text, not this field");
    expect(m.split("\n").filter((x) => x.startsWith("E"))).toHaveLength(4);
  });

  it("the arrangement is one of textKey, keyText and text", async () => {
    const m = (
      await msgs(`
export interface Office {
    @ui.valueLabel 'cityName', 'key'
    city?: string
    cityName?: string
}`)
    ).join("\n");
    expect(m).toContain('("arrangement") must be one of [textKey, keyText, text]');
  });

  it("VL2: not next to @ui.literalLabel, own or from the type", async () => {
    const m = (
      await msgs(`
@ui.literalLabel 'a', 'A'
export type Coded = 'a' | 'b'
export interface Office {
    label?: string
    @ui.literalLabel 'x', 'X'
    @ui.valueLabel 'label'
    own?: 'x' | 'y'
    @ui.valueLabel 'label'
    typed?: Coded
}`)
    ).join("\n");
    expect(m).toContain("@ui.valueLabel cannot coexist with @ui.literalLabel on the same field");
    expect(m).toContain(
      "@ui.valueLabel cannot coexist with @ui.literalLabel, which this field inherits from its type reference",
    );
  });

  it("VL3: a bound field whose text no pick fills warns; a fill or no binding does not", async () => {
    const m = await msgs(`
export interface Office {
    @ui.valueHelp City, 'code'
    @ui.valueLabel 'cityName'
    city?: string
    cityName?: string
    @ui.valueHelp City, 'code'
    @ui.valueHelp.fill 'townName', 'name'
    @ui.valueLabel 'townName'
    town?: string
    townName?: string
    @db.rel.FK
    @ui.valueLabel 'countryName'
    countryCode?: Country.code
    countryName?: string
    @ui.valueLabel 'zoneName'
    zone?: string
    zoneName?: string
}`);
    // (City's `code` alone is no key: the bindings also warn that values may repeat)
    const w = m.filter((x) => x.startsWith("W") && x.includes("goes stale"));
    expect(w).toHaveLength(2);
    expect(w.join("\n")).toContain(
      "a pick of this field's value help does not fill 'cityName' — the text goes stale after a pick (add @ui.valueHelp.fill 'cityName', '<a field of City>')",
    );
    expect(w.join("\n")).toContain("does not fill 'countryName'");
    expect(errorsOf(m)).toEqual([]);
  });

  it("runs in an annotate entry: inherited siblings, the landed binding and its fills", async () => {
    const m = (
      await msgs(`
export interface BaseOffice {
    city?: string
    cityName?: string
    town?: string
    townName?: string
    headcount?: number
}
export interface Office extends BaseOffice {}
annotate Office {
    @ui.valueLabel 'cityName'
    city
    @ui.valueHelp City, 'code'
    @ui.valueHelp.fill 'townName', 'name'
    @ui.valueLabel 'townName'
    town
}
annotate Office {
    @ui.valueHelp City, 'code'
    @ui.valueLabel 'headcount'
    cityName
}`)
    ).join("\n");
    expect(m).toContain("@ui.valueLabel 'headcount': sibling field must be a string, got 'number'");
    expect(m).toContain("does not fill 'headcount'");
    expect(m).not.toContain("'cityName':");
    expect(m).not.toContain("does not fill 'townName'");
  });
});

describe("editor features of @ui.valueLabel", () => {
  const INLINE = `
export interface BaseOffice {
    regionName?: string
}
export interface Office extends BaseOffice {
    headcount: number
    @ui.valueLabel 'cityName', 'textKey'
    city?: string
    cityName?: string
}`;
  const ANNOTATED = `
export interface BaseOffice {
    regionName?: string
}
export interface Office extends BaseOffice {
    headcount: number
    city?: string
    cityName?: string
}
annotate Office {
    @ui.valueLabel 'cityName', 'textKey'
    city
}`;

  it("is documented with both arguments, a prop-only annotation that stays home", async () => {
    const { doc } = await compile("export interface Host { a: string }");
    const spec = doc.resolveAnnotation("ui.valueLabel")!;
    expect(spec.config.description).toContain("Sorting and filtering stay on the code");
    expect(spec.arguments.map((a) => a.name)).toEqual(["field", "arrangement"]);
    for (const arg of spec.arguments) expect(arg.description, arg.name).toBeTruthy();
    expect(spec.arguments[1]).toMatchObject({
      optional: true,
      values: ["textKey", "keyText", "text"],
    });
    expect(spec.config).toMatchObject({ nodeType: ["prop"], passedWhenReferred: false });
    // offered among the `ui` annotations the editor completes
    expect(Object.keys(doc.config.annotations!.ui as object)).toContain("valueLabel");
    expect(spec.renderDocs("@ui.valueLabel")).toContain("filter chips show the code");
  });

  for (const [where, source] of [
    ["inline", INLINE],
    ["in an annotate entry", ANNOTATED],
  ] as const) {
    describe(where, () => {
      it("`field` completes the string fields of the interface, inherited ones included", async () => {
        const { doc } = await compile(source);
        const ann = doc.annotations.find((a) => a.name === "ui.valueLabel")!;
        // never the annotated field itself, nor a number
        expect(getValueCandidates(ann.token, 0, doc)?.map((c) => c.value)).toEqual([
          "regionName",
          "cityName",
        ]);
      });

      it("go-to-definition on `field` jumps to the sibling, also an inherited one", async () => {
        const { doc, text } = await compile(source);
        const ann = doc.annotations.find((a) => a.name === "ui.valueLabel")!;
        const declared = getDeclaredValue(ann.args[0], doc);
        expect(declared?.value).toBe("cityName");
        const pos = at(text, "'cityName', 'textKey'", 3);
        const result = doc.getToDefinitionAt(pos.line, pos.character)!;
        expect(result[0].targetSelectionRange.start.line).toBe(at(text, "cityName?: string").line);
        const inherited = getValueCandidates(ann.token, 0, doc)!.find(
          (c) => c.value === "regionName",
        )!;
        expect(inherited.definition?.token.range.start.line).toBe(
          at(text, "regionName?: string").line,
        );
      });

      it("hover documents the annotation; diagnostics land on the entry", async () => {
        const { doc, messages } = await compile(source);
        expect(messages).toEqual([]);
        const ann = doc.annotations.find((a) => a.name === "ui.valueLabel")!;
        expect(doc.resolveAnnotation(ann.name)?.renderDocs(ann.token.text)).toContain(
          "together with its text",
        );
      });
    });
  }
});
