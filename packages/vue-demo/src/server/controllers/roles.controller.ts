import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@aooth/arbac-moost";
import { rolesTable } from "../db";
import type { RolesTable } from "../schemas/roles.as";
import { SessionGuard } from "../auth/session.guard";
import { DemoArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("roles")
@TableController(rolesTable, "db/tables/roles")
export class RolesController extends DemoArbacDbController<typeof RolesTable> {}
