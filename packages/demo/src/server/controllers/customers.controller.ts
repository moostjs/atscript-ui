import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@moostjs/arbac";
import { customersTable } from "../db";
import type { CustomersTable } from "../schemas/customers.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("customers")
@TableController(customersTable, "db/tables/customers")
export class CustomersController extends AsArbacDbController<typeof CustomersTable> {}
