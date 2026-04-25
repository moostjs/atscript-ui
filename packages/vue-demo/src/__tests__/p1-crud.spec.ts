import { describe, it, expect } from "vite-plus/test";
import { createAdapter } from "@atscript/db-sqlite";
import { syncSchema } from "@atscript/db/sync";
import { RolesTable } from "../server/schemas/roles.as";
import { UsersTable } from "../server/schemas/users.as";

describe("p1 crud", () => {
  it("syncs schema and roundtrips a user", async () => {
    const space = createAdapter(":memory:");
    await syncSchema(space, [RolesTable, UsersTable], { force: true });
    const roles = space.getTable(RolesTable);
    const users = space.getTable(UsersTable);

    await roles.insertOne({ name: "admin", description: "Full access" });
    const role = await roles.findOne({ filter: { name: "admin" } });
    expect(role).toBeTruthy();
    const roleId = role!.id;

    await users.insertOne({
      username: "alice",
      email: "alice@demo.test",
      roleId,
      status: "active",
      mfaEnabled: false,
      password: "",
      salt: "",
    });
    const fetched = await users.findOne({ filter: { username: "alice" } });
    expect(fetched?.email).toBe("alice@demo.test");
  });
});
