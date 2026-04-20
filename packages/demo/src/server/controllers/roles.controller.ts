import { TableController, AsDbController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { rolesTable } from "../db";
import type { RolesTable } from "../schemas/roles.as";
import { SessionGuard } from "../auth/session.guard";

@Authenticate(SessionGuard)
@TableController(rolesTable, "db/tables/roles")
export class RolesController extends AsDbController<typeof RolesTable> {}
