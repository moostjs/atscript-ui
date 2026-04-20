import { TableController, AsDbController } from "@atscript/moost-db";
import { usersTable } from "../db";
import type { UsersTable } from "../schemas/users.as";

@TableController(usersTable, "db/tables/users")
export class UsersController extends AsDbController<typeof UsersTable> {}
