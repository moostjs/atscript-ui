import { TableController, AsDbController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { usersTable } from "../db";
import type { UsersTable } from "../schemas/users.as";
import { SessionGuard } from "../auth/session.guard";

@Authenticate(SessionGuard)
@TableController(usersTable, "db/tables/users")
export class UsersController extends AsDbController<typeof UsersTable> {}
