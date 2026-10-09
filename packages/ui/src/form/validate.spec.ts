import { describe, expect, it } from "vitest";
import {
  Validator,
  defineAnnotatedType,
  type TAtscriptAnnotatedType,
  type TValidatorPlugin,
} from "@atscript/typescript/utils";
import { DerivedRow } from "../__tests__/fixtures/create-form-def.as";
import { BookForm } from "../__tests__/fixtures/value-help-fk.as";
import { createFormDef } from "./create-form-def";
import {
  createFieldValidator,
  getDefaultValidatorPlugins,
  getFormValidator,
  setDefaultValidatorPlugins,
} from "./validate";

// A create form: the user filled only what they own. `customerId` is a
// REQUIRED (`@meta.required`, non-optional) `@db.column.derived` field;
// `createdAt` (`@db.default.now`) and `version` (`@db.column.version`) are
// server-managed too.
const created = { id: 1, name: "Ada", payload: { customer: { id: "c1" } } };

describe("server-managed db fields", () => {
  it("a create form leaving derived / default / version empty passes the form validator", () => {
    const validate = getFormValidator(createFormDef(DerivedRow));
    expect(validate({ data: created })).toEqual({});
    // A derived value is never validated — `@meta.required` on "" included.
    expect(validate({ data: { ...created, customerId: "" } })).toEqual({});
  });

  it("the per-field validator passes an empty derived field", () => {
    const prop = createFormDef(DerivedRow).flatMap.get("customerId")!;
    const validate = createFieldValidator(prop);
    expect(validate(undefined)).toBe(true);
    expect(validate("")).toBe(true);
  });

  it("an ordinary required field still fails", () => {
    const validate = getFormValidator(createFormDef(DerivedRow));
    const { name: _, ...rest } = created;
    expect(Object.keys(validate({ data: rest }))).toEqual(["name"]);
  });

  it("a present @db.default value is still validated", () => {
    const validate = getFormValidator(createFormDef(DerivedRow));
    expect(Object.keys(validate({ data: { ...created, createdAt: "now" } }))).toEqual([
      "createdAt",
    ]);
  });

  it("an empty required FK still fails (the form fills it, not the server)", () => {
    const validate = getFormValidator(createFormDef(BookForm));
    expect(Object.keys(validate({ data: { title: "Dune" } }))).toEqual(["authorId"]);
  });
});

// ── rootOnly container validation (perf: descendants are not walked) ──

describe("createFieldValidator rootOnly", () => {
  const str = (meta: Record<string, unknown> = {}) => {
    const t = defineAnnotatedType().designType("string").$type;
    for (const [k, v] of Object.entries(meta)) t.metadata.set(k as never, v as never);
    return t;
  };
  const obj = (props: Record<string, TAtscriptAnnotatedType>) => {
    const h = defineAnnotatedType("object");
    for (const [k, v] of Object.entries(props)) h.prop(k, v);
    return h.$type;
  };
  const arr = (of: TAtscriptAnnotatedType, meta: Record<string, unknown> = {}) => {
    const t = defineAnnotatedType("array").of(of).$type;
    for (const [k, v] of Object.entries(meta)) t.metadata.set(k as never, v as never);
    return t;
  };
  const union = (...items: TAtscriptAnnotatedType[]) => {
    const h = defineAnnotatedType("union");
    for (const i of items) h.item(i);
    return h.$type;
  };
  const tuple = (...items: TAtscriptAnnotatedType[]) => {
    const h = defineAnnotatedType("tuple");
    for (const i of items) h.item(i);
    return h.$type;
  };

  /** The pre-optimization algorithm: full walk, then pick the root-path error. */
  function fullWalkRootOnly(prop: TAtscriptAnnotatedType) {
    const v = new Validator(prop, { plugins: [...getDefaultValidatorPlugins()] });
    return (value: unknown) => {
      if (v.validate(value, true)) return true;
      return v.errors.find((e) => e.path === "")?.message ?? true;
    };
  }

  const required = str({ "expect.minLength": { length: 1 } });
  const item = obj({ a: required, b: required });
  const cases: Array<[string, TAtscriptAnnotatedType, unknown[]]> = [
    [
      "object",
      obj({ x: required, nested: item, list: arr(item) }),
      [
        { x: "ok", nested: { a: "1", b: "2" }, list: [{ a: "1", b: "2" }] },
        { x: "", nested: { a: "", b: "" }, list: [{ a: "", b: 1 }] },
        "not an object",
        null,
        [],
      ],
    ],
    [
      "array with length bounds",
      arr(item, { "expect.minLength": { length: 2 }, "expect.maxLength": { length: 3 } }),
      [
        [{ a: "1", b: "2" }],
        [
          { a: "", b: "" },
          { a: "", b: "" },
        ],
        [
          { a: "1", b: "2" },
          { a: "1", b: "2" },
          { a: "1", b: "2" },
          { a: "1", b: "2" },
        ],
        "nope",
      ],
    ],
    [
      "array with unique items",
      arr(str(), { "expect.array.uniqueItems": true }),
      [
        ["a", "b"],
        ["a", "a"],
      ],
    ],
    ["tuple", tuple(required, item), [["x", { a: "1", b: "2" }], ["", { a: "", b: "" }], ["x"]]],
    [
      "union of objects (full walk kept)",
      union(obj({ kind: str(), a: required }), obj({ b: required })),
      [{ kind: "k", a: "1" }, { b: "" }, { a: "" }, 42],
    ],
    [
      "object holding a union",
      obj({ u: union(required, arr(str())) }),
      [{ u: "" }, { u: 5 }, { u: ["x"] }],
    ],
  ];

  for (const [name, prop, values] of cases) {
    it(`${name}: same root verdict as the full walk`, () => {
      const fast = createFieldValidator(prop, { rootOnly: true });
      const ref = fullWalkRootOnly(prop);
      for (const value of values) expect(fast(value)).toEqual(ref(value));
    });
  }

  it("a container-level custom validator still runs at the root", () => {
    const prop = obj({ a: required });
    const rootRule: TValidatorPlugin = (ctx, def, value) =>
      def === prop && (value as { a?: string }).a === "bad"
        ? (ctx.error("root says no"), false)
        : undefined;
    const prev = getDefaultValidatorPlugins();
    setDefaultValidatorPlugins([rootRule]);
    try {
      const fast = createFieldValidator(prop, { rootOnly: true });
      expect(fast({ a: "bad" })).toBe("root says no");
      expect(fast({ a: "" })).toBe(true); // child error, not a root one
    } finally {
      setDefaultValidatorPlugins(prev);
    }
  });

  it("does not visit descendants of an object / array root", () => {
    const visited: string[] = [];
    const spy: TValidatorPlugin = (ctx) => {
      visited.push(ctx.path);
      return undefined;
    };
    const prev = getDefaultValidatorPlugins();
    setDefaultValidatorPlugins([spy]);
    try {
      createFieldValidator(arr(item), { rootOnly: true })([
        { a: "", b: "" },
        { a: "1", b: "2" },
      ]);
      expect(visited).toEqual([""]);
      visited.length = 0;
      // Without rootOnly the full walk still happens.
      createFieldValidator(arr(item))([{ a: "1", b: "2" }]);
      expect(visited).toEqual(["", "0", "0.a", "0.b"]);
    } finally {
      setDefaultValidatorPlugins(prev);
    }
  });
});
