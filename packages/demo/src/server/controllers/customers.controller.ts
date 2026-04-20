import { TableController, AsDbController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { customersTable } from "../db";
import type { CustomersTable } from "../schemas/customers.as";
import { SessionGuard } from "../auth/session.guard";

@Authenticate(SessionGuard)
@TableController(customersTable, "db/tables/customers")
export class CustomersController extends AsDbController<typeof CustomersTable> {}
