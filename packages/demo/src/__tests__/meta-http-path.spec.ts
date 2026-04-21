import { describe, it, expect } from "vite-plus/test";
import { Moost } from "moost";
import { MoostHttp } from "@moostjs/event-http";
import { AsDbReadableController, TableController } from "@atscript/moost-db";
import { createAdapter } from "@atscript/db-sqlite";
import { syncSchema } from "@atscript/db/sync";
import { RolesTable } from "../server/schemas/roles.as";

describe("meta endpoint carries db.http.path", () => {
  it("serialized type metadata contains the full controller path (globalPrefix + prefix)", async () => {
    const space = createAdapter(":memory:");
    await syncSchema(space, [RolesTable], { force: true });
    const rolesTable = space.getTable(RolesTable);

    @TableController(rolesTable, "db/tables/roles")
    class TestRolesController extends AsDbReadableController<typeof RolesTable> {}

    const app = new Moost({ globalPrefix: "api" });
    const http = new MoostHttp();
    app.adapter(http);
    app.registerControllers(TestRolesController);
    await app.init();

    const response = await http.request("/api/db/tables/roles/meta");
    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);

    const data = (await response!.json()) as {
      type: { metadata?: Record<string, unknown> };
    };
    const httpPath = data.type?.metadata?.["db.http.path"];

    // Contract per atscript-db/docs/adapters/annotations.md:
    // "the controller's final computed prefix (including any parent route nesting)
    //  is always written back to @db.http.path on the type metadata."
    expect(httpPath).toBeDefined();
    expect(httpPath).toBe("/api/db/tables/roles");
  });
});
