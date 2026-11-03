// Type-level checks, enforced by the type-aware lint (`vp lint`): the
// app-wide factory hands out typed clients on request and untyped ones by
// default, and any factory returning a `Client` can be installed.
import { Client } from "@atscript/db-client";
import { describe, expect, expectTypeOf, it } from "vitest";
import { getDefaultClientFactory, setDefaultClientFactory } from "../client-factory";
// An atscript-generated `@db.table` model: `{ id: number; name: string }`.
import type { NavUsers } from "./fixtures/model-routes.as";

describe("ClientFactory types", () => {
  it("a typed call returns a typed client", () => {
    // Never executed — the writes would hit the network.
    const compileOnly = () => {
      const products = getDefaultClientFactory()<typeof NavUsers>("/db/tables/products");
      expectTypeOf(products).toEqualTypeOf<Client<typeof NavUsers>>();
      void products.insert({ id: 1, name: "Lamp" });
      void products.update({ id: 1, name: "Desk lamp" });
      // @ts-expect-error `name` is a string
      void products.insert({ id: 1, name: 2 });
      // @ts-expect-error `id` is a number
      void products.update({ id: "1" });
    };
    expect(typeof compileOnly).toBe("function");
  });

  it("an untyped call stays loose", () => {
    const compileOnly = () => {
      const client = getDefaultClientFactory()("/db/tables/anything");
      expectTypeOf(client).toEqualTypeOf<Client>();
      void client.insert({ whatever: 1 });
    };
    expect(typeof compileOnly).toBe("function");
  });

  it("accepts a factory that hands back an existing client", () => {
    const compileOnly = () => {
      const cached = new Client("/db/tables/products");
      setDefaultClientFactory(() => cached);
      setDefaultClientFactory((url, options) => new Client(url, options));
    };
    expect(typeof compileOnly).toBe("function");
  });
});
