import { TableController, AsDbController } from "@atscript/moost-db";
import { rolesTable } from "../db";
import type { RolesTable } from "../schemas/roles.as";

@TableController(rolesTable, "db/tables/roles")
export class RolesController extends AsDbController<typeof RolesTable> {}
