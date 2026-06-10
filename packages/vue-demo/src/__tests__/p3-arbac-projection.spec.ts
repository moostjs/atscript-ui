import { describe, it, expect } from "vite-plus/test";
import type { TMetaResponse } from "@atscript/db";
import { narrowMetaFields } from "../server/auth/arbac-db.controller";

// Read-side $select narrowing and write-payload stripping moved upstream to
// @aooth/arbac-moost (restrictProjection / applyAllowedFieldsAndSet, tested
// there). What stays demo-local is the /meta `fields` narrowing — the UI
// builds its column set from /meta, so scoped roles must not even see
// restricted field names listed (e2e section 20.3).
function metaWith(fields: string[]): TMetaResponse {
  const f: TMetaResponse["fields"] = {};
  for (const k of fields) f[k] = { sortable: true, filterable: true };
  return {
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    primaryKeys: ["id"],
    preferredId: ["id"],
    relations: [],
    fields: f,
    type: { kind: "object" } as unknown as TMetaResponse["type"],
    actions: [],
    crud: {},
  };
}

describe("p3 arbac narrowMetaFields (/meta overlay helper)", () => {
  it("no scopes (public / direct instantiation) → envelope untouched", () => {
    const meta = metaWith(["id", "password"]);
    expect(narrowMetaFields(meta, [])).toBe(meta);
  });

  it("universe scope ({} — admin-ish) → envelope untouched", () => {
    const meta = metaWith(["id", "password"]);
    expect(narrowMetaFields(meta, [{}])).toBe(meta);
  });

  it("projection scope → drops fields outside the whitelist", () => {
    const meta = metaWith(["id", "username", "password", "salt"]);
    const out = narrowMetaFields(meta, [{ projection: { id: 1, username: 1 } }]);
    expect(Object.keys(out.fields)).toEqual(["id", "username"]);
  });

  it("union across multiple scopes (additive: broader access wins)", () => {
    const meta = metaWith(["id", "name", "email", "secret"]);
    const out = narrowMetaFields(meta, [
      { projection: { id: 1, name: 1 } },
      { projection: { name: 1, email: 1 } },
    ]);
    expect(Object.keys(out.fields).toSorted()).toEqual(["email", "id", "name"]);
  });

  it("any unrestricted scope in the union → envelope untouched", () => {
    const meta = metaWith(["id", "secret"]);
    const out = narrowMetaFields(meta, [{ projection: { id: 1 } }, {}]);
    expect(Object.keys(out.fields)).toEqual(["id", "secret"]);
  });
});
