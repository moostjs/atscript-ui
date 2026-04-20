import { TableController, AsDbController } from "@atscript/moost-db";
import { customersTable } from "../db";
import type { CustomersTable } from "../schemas/customers.as";

@TableController(customersTable, "db/tables/customers")
export class CustomersController extends AsDbController<typeof CustomersTable> {}
