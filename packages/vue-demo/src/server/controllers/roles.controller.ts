import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@moostjs/arbac";
import { Intercept } from "moost";
import { rolesTable } from "../db";
import type { RolesTable } from "../schemas/roles.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";
import { latencyInterceptor } from "../interceptors/latency";

@Intercept(latencyInterceptor)
@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("roles")
@TableController(rolesTable, "db/tables/roles")
export class RolesController extends AsArbacDbController<typeof RolesTable> {}
