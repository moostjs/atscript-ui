import { describe, expect, it } from "vitest";
import type { FilterExpr } from "@uniqu/core";
import {
  residualGateOwns,
  resolveAspectGate,
  stateToUrlQueryString,
  urlQueryConsumesKey,
  urlQueryStringToState,
  type UrlQueryParseOptions,
  type UrlQueryStateLike,
  type UrlQuerySync,
} from "./url-query";
import type { FieldFilters } from "../filters/filter-types";

const DEFAULTS = { defaultItemsPerPage: 10 };

/** JSON view — drops `undefined` members, as the golden outputs were recorded. */
const plain = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown;

// Recorded from the published 0.1.139 build. `sync.residual: false` must
// reproduce it byte for byte.
const GOLDEN_DECODED: [string, UrlQueryParseOptions, unknown][] = [
  [
    "(path=FAST&raisedAt<=100)^(path=SLOW&raisedAt<=50)&$snapshot",
    {},
    {
      filters: {},
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "cross-field",
          expr: {
            $or: [
              {
                path: "FAST",
                raisedAt: {
                  $lte: 100,
                },
              },
              {
                path: "SLOW",
                raisedAt: {
                  $lte: 50,
                },
              },
            ],
          },
          fields: ["path", "raisedAt"],
        },
      ],
      snapshot: true,
    },
  ],
  [
    "(path=FAST&raisedAt<=100)^(path=SLOW&raisedAt<=50)&$snapshot",
    {
      knownFields: ["path", "raisedAt", "customerId", "status", "total", "a"],
    },
    {
      filters: {},
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "cross-field",
          expr: {
            $or: [
              {
                path: "FAST",
                raisedAt: {
                  $lte: 100,
                },
              },
              {
                path: "SLOW",
                raisedAt: {
                  $lte: 50,
                },
              },
            ],
          },
          fields: ["path", "raisedAt"],
        },
      ],
      snapshot: true,
    },
  ],
  [
    "(path=FAST&raisedAt<=100)^(path=SLOW&raisedAt<=50)&$snapshot",
    {
      sync: {
        filters: ["status", "total"],
      },
    },
    {
      filters: {},
      sorters: [],
      searchTerm: "",
      snapshot: true,
    },
  ],
  [
    "customerId=2&((status=shipped&total>500)^(status=pending&total<=50))&$snapshot",
    {},
    {
      filters: {
        customerId: [
          {
            type: "eq",
            value: [2],
          },
        ],
      },
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "cross-field",
          expr: {
            $or: [
              {
                status: "shipped",
                total: {
                  $gt: 500,
                },
              },
              {
                status: "pending",
                total: {
                  $lte: 50,
                },
              },
            ],
          },
          fields: ["status", "total"],
        },
      ],
      snapshot: true,
    },
  ],
  [
    "customerId=2&((status=shipped&total>500)^(status=pending&total<=50))&$snapshot",
    {
      knownFields: ["path", "raisedAt", "customerId", "status", "total", "a"],
    },
    {
      filters: {
        customerId: [
          {
            type: "eq",
            value: [2],
          },
        ],
      },
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "cross-field",
          expr: {
            $or: [
              {
                status: "shipped",
                total: {
                  $gt: 500,
                },
              },
              {
                status: "pending",
                total: {
                  $lte: 50,
                },
              },
            ],
          },
          fields: ["status", "total"],
        },
      ],
      snapshot: true,
    },
  ],
  [
    "customerId=2&((status=shipped&total>500)^(status=pending&total<=50))&$snapshot",
    {
      sync: {
        filters: ["status", "total"],
      },
    },
    {
      filters: {},
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "cross-field",
          expr: {
            $or: [
              {
                status: "shipped",
                total: {
                  $gt: 500,
                },
              },
              {
                status: "pending",
                total: {
                  $lte: 50,
                },
              },
            ],
          },
          fields: ["status", "total"],
        },
      ],
      snapshot: true,
    },
  ],
  [
    "a>1&a<5&$snapshot",
    {},
    {
      filters: {
        a: [
          {
            type: "gt",
            value: [1],
          },
        ],
      },
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "conjunction",
          expr: {
            a: {
              $lt: 5,
            },
          },
          fields: ["a"],
        },
      ],
      snapshot: true,
    },
  ],
  [
    "a>1&a<5&$snapshot",
    {
      knownFields: ["path", "raisedAt", "customerId", "status", "total", "a"],
    },
    {
      filters: {
        a: [
          {
            type: "gt",
            value: [1],
          },
        ],
      },
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "conjunction",
          expr: {
            a: {
              $lt: 5,
            },
          },
          fields: ["a"],
        },
      ],
      snapshot: true,
    },
  ],
  [
    "a>1&a<5&$snapshot",
    {
      sync: {
        filters: ["status", "total"],
      },
    },
    {
      filters: {},
      sorters: [],
      searchTerm: "",
      snapshot: true,
    },
  ],
  [
    "status=A&!(!(status=B))",
    {},
    {
      filters: {
        status: [
          {
            type: "eq",
            value: ["B"],
          },
        ],
      },
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "conjunction",
          expr: {
            status: "A",
          },
          fields: ["status"],
        },
      ],
    },
  ],
  [
    "status=A&!(!(status=B))",
    {
      knownFields: ["path", "raisedAt", "customerId", "status", "total", "a"],
    },
    {
      filters: {
        status: [
          {
            type: "eq",
            value: ["B"],
          },
        ],
      },
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "conjunction",
          expr: {
            status: "A",
          },
          fields: ["status"],
        },
      ],
    },
  ],
  [
    "status=A&!(!(status=B))",
    {
      sync: {
        filters: ["status", "total"],
      },
    },
    {
      filters: {
        status: [
          {
            type: "eq",
            value: ["B"],
          },
        ],
      },
      sorters: [],
      searchTerm: "",
      unsupported: [
        {
          reason: "conjunction",
          expr: {
            status: "A",
          },
          fields: ["status"],
        },
      ],
    },
  ],
  [
    "!(status=shipped&total>500)&$sort=-total",
    {},
    {
      filters: {},
      sorters: [
        {
          field: "total",
          direction: "desc",
        },
      ],
      searchTerm: "",
      unsupported: [
        {
          reason: "cross-field",
          expr: {
            $not: {
              status: "shipped",
              total: {
                $gt: 500,
              },
            },
          },
          fields: ["status", "total"],
        },
      ],
    },
  ],
  [
    "!(status=shipped&total>500)&$sort=-total",
    {
      knownFields: ["path", "raisedAt", "customerId", "status", "total", "a"],
    },
    {
      filters: {},
      sorters: [
        {
          field: "total",
          direction: "desc",
        },
      ],
      searchTerm: "",
      unsupported: [
        {
          reason: "cross-field",
          expr: {
            $not: {
              status: "shipped",
              total: {
                $gt: 500,
              },
            },
          },
          fields: ["status", "total"],
        },
      ],
    },
  ],
  [
    "!(status=shipped&total>500)&$sort=-total",
    {
      sync: {
        filters: ["status", "total"],
      },
    },
    {
      filters: {},
      sorters: [
        {
          field: "total",
          direction: "desc",
        },
      ],
      searchTerm: "",
      unsupported: [
        {
          reason: "cross-field",
          expr: {
            $not: {
              status: "shipped",
              total: {
                $gt: 500,
              },
            },
          },
          fields: ["status", "total"],
        },
      ],
    },
  ],
  [
    "status{a,b}&x=1&$search=foo",
    {},
    {
      filters: {
        status: [
          {
            type: "eq",
            value: ["a"],
          },
          {
            type: "eq",
            value: ["b"],
          },
        ],
        x: [
          {
            type: "eq",
            value: [1],
          },
        ],
      },
      sorters: [],
      searchTerm: "foo",
    },
  ],
  [
    "status{a,b}&x=1&$search=foo",
    {
      knownFields: ["path", "raisedAt", "customerId", "status", "total", "a"],
    },
    {
      filters: {
        status: [
          {
            type: "eq",
            value: ["a"],
          },
          {
            type: "eq",
            value: ["b"],
          },
        ],
      },
      sorters: [],
      searchTerm: "foo",
    },
  ],
  [
    "status{a,b}&x=1&$search=foo",
    {
      sync: {
        filters: ["status", "total"],
      },
    },
    {
      filters: {
        status: [
          {
            type: "eq",
            value: ["a"],
          },
          {
            type: "eq",
            value: ["b"],
          },
        ],
      },
      sorters: [],
      searchTerm: "foo",
    },
  ],
];

const RESIDUAL: FilterExpr = {
  $or: [
    { status: "shipped", total: { $gt: 500 } },
    { status: "pending", total: { $lte: 50 } },
  ],
};
const GOLDEN_FILTERS: FieldFilters = {
  customerId: [{ type: "eq", value: [2] }],
  total: [{ type: "bw", value: [1, 5] }],
};
const GOLDEN_ENCODED: [UrlQueryStateLike, { sync?: UrlQuerySync }, string][] = [
  [
    {
      filters: GOLDEN_FILTERS,
      sorters: [{ field: "total", direction: "desc" }],
      page: 3,
      searchTerm: "x",
    },
    {},
    "customerId=2&total>=1&total<=5&$sort=-total&$skip=20&$search=x&$snapshot",
  ],
  [
    { filters: GOLDEN_FILTERS, sorters: [] },
    { sync: { filters: ["total"] } },
    "total>=1&total<=5&$snapshot",
  ],
  [{ filters: {}, sorters: [] }, {}, "$snapshot"],
];

describe("urlQuerySync.residual: false — byte-identical to 0.1.139", () => {
  it.each(GOLDEN_DECODED)("decodes %s like 0.1.139 (%j)", (url, opts, expected) => {
    const sync = { ...opts.sync, residual: false };
    expect(plain(urlQueryStringToState(url, { ...opts, sync }))).toEqual(expected);
  });

  it.each(GOLDEN_ENCODED)("encodes like 0.1.139 even with residual state (%#)", (state, d, url) => {
    const sync = { ...d.sync, residual: false };
    const withResidual = { ...state, residualFilters: [RESIDUAL] };
    expect(stateToUrlQueryString(withResidual, { ...DEFAULTS, sync })).toBe(url);
  });

  it("encodes like 0.1.139 when the state has no residual (default sync)", () => {
    for (const [state, d, url] of GOLDEN_ENCODED) {
      expect(stateToUrlQueryString(state, { ...DEFAULTS, ...d })).toBe(url);
    }
  });
});

describe("urlQueryStringToState — residual", () => {
  it("carries a correlated cross-field $or instead of dropping it", () => {
    const out = urlQueryStringToState(
      "(path=FAST&raisedAt<=100)^(path=SLOW&raisedAt<=50)&$snapshot",
    );
    const expr = {
      $or: [
        { path: "FAST", raisedAt: { $lte: 100 } },
        { path: "SLOW", raisedAt: { $lte: 50 } },
      ],
    };
    expect(out.filters).toEqual({});
    expect(out.residual).toEqual([expr]);
    expect(out.unsupported).toBeUndefined();
  });

  it("keeps the representable part as field filters", () => {
    const out = urlQueryStringToState(
      "customerId=2&((status=shipped&total>500)^(status=pending&total<=50))",
    );
    expect(out.filters).toEqual({ customerId: [{ type: "eq", value: [2] }] });
    expect(out.residual).toEqual([RESIDUAL]);
  });

  it("does not carry a piece that touches an unknown field", () => {
    const out = urlQueryStringToState("(status=shipped^ghost=1)&total>5", {
      knownFields: ["status", "total"],
    });
    expect(out.filters).toEqual({ total: [{ type: "gt", value: [5] }] });
    expect(out.residual).toBeUndefined();
    expect(out.unsupported).toHaveLength(1);
  });

  it("carries only pieces the filter allowlist owns", () => {
    const url = "(status=shipped^total>5)&(status=x^customerId=2)";
    const out = urlQueryStringToState(url, { sync: { filters: ["status", "total"] } });
    expect(out.residual).toEqual([{ $or: [{ status: "shipped" }, { total: { $gt: 5 } }] }]);
    expect(out.unsupported).toHaveLength(1);
  });

  it("carries nothing when filter sync is off", () => {
    const out = urlQueryStringToState("(a=1^b=2)", { sync: { filters: false } });
    expect(out.residual).toBeUndefined();
    expect(out.unsupported).toBeUndefined();
  });
});

describe("stateToUrlQueryString — residual", () => {
  it("writes residual conditions after the field filters", () => {
    const url = stateToUrlQueryString(
      {
        filters: { customerId: [{ type: "eq", value: [2] }] },
        residualFilters: [RESIDUAL],
        sorters: [],
      },
      DEFAULTS,
    );
    expect(url).toBe(
      "customerId=2&((status=shipped&total>500)^(status=pending&total<=50))&$snapshot",
    );
  });

  it("keeps a residual that touches a private field out of the URL", () => {
    const url = stateToUrlQueryString(
      {
        filters: {},
        residualFilters: [{ $or: [{ status: "x" }, { secret: 1 }] }, { status: { $in: [] } }],
        sorters: [],
      },
      { ...DEFAULTS, sync: { filters: ["status"] } },
    );
    expect(url).toBe("status{}&$snapshot");
  });
});

describe("residual URL round trip is a fixed point", () => {
  const CORPUS = [
    "(path=FAST&raisedAt<=100)^(path=SLOW&raisedAt<=50)&$snapshot",
    "customerId=2&((status=shipped&total>500)^(status=pending&total<=50))&$snapshot",
    "a>1&a<5&$snapshot",
    "a!=3&a>1&a<5&$snapshot",
    // (`status=A&status=B` itself is not in the corpus: @uniqu/url's parser
    // collapses it to `status=A` before the table sees it.)
    "status=A&!(!(status=B))&$snapshot",
    "!(status=shipped&total>500)&customerId=2&$snapshot",
    "(a=1^b=2)&(c=3^d=4)&e>1&$snapshot",
    "(a=1&m=1&b=1)^(c=1&m=1&d=1)&$snapshot",
    "(status=a^status=b)&total>5&(total<1^customerId=3)&$snapshot",
  ];

  it.each(CORPUS)("%s", (url) => {
    const decode = (s: string) => urlQueryStringToState(s);
    const encode = (s: ReturnType<typeof decode>) =>
      stateToUrlQueryString(
        { filters: s.filters, residualFilters: s.residual, sorters: s.sorters },
        DEFAULTS,
      );
    const first = decode(url);
    const once = encode(first);
    const second = decode(once);
    expect(plain(second.filters)).toEqual(plain(first.filters));
    expect(plain(second.residual)).toEqual(plain(first.residual));
    expect(encode(second)).toBe(once);
  });

  it("puts a field with two positive groups wholly into the residual", () => {
    const out = urlQueryStringToState("a!=3&a>1&a<5");
    expect(out.filters).toEqual({ a: [{ type: "ne", value: [3] }] });
    // Canonical order — by URL spelling (`a<5` sorts before `a>1`).
    expect(out.residual).toEqual([{ a: { $lt: 5 } }, { a: { $gt: 1 } }]);
  });

  it("reads a double negation as the clause itself", () => {
    const out = urlQueryStringToState("status=A&!(!(status=B))");
    expect(out.filters).toEqual({});
    expect(out.residual).toEqual([{ status: "A" }, { status: "B" }]);
  });
});

describe("residualGateOwns", () => {
  it("owns a condition only when the gate owns every field it references", () => {
    const gate = resolveAspectGate(["a", "b"]);
    expect(residualGateOwns(gate, { $or: [{ a: 1 }, { b: 2 }] })).toBe(true);
    expect(residualGateOwns(gate, { $or: [{ a: 1 }, { c: 2 }] })).toBe(false);
    expect(residualGateOwns("all", { c: 1 })).toBe(true);
    expect(residualGateOwns("none", { a: 1 })).toBe(false);
  });
});

describe("urlQueryConsumesKey — grouped and list filter keys", () => {
  it.each(["(path=FAST&raisedAt=1)^(path=SLOW)", "status{a,b}", "a=1^b=2", "!(a=1&b=2)"])(
    "claims %s",
    (key) => expect(urlQueryConsumesKey(key)).toBe(true),
  );
  it("still leaves plain host keys alone", () => {
    expect(urlQueryConsumesKey("tab")).toBe(false);
    expect(urlQueryConsumesKey("$exists")).toBe(false);
  });
});
