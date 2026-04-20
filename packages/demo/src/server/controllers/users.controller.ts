import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@moostjs/arbac";
import { usersTable } from "../db";
import type { UsersTable } from "../schemas/users.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("users")
@TableController(usersTable, "db/tables/users")
export class UsersController extends AsArbacDbController<typeof UsersTable> {}
