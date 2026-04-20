import { TableController, AsDbController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ordersTable } from "../db";
import type { OrdersTable } from "../schemas/orders.as";
import { SessionGuard } from "../auth/session.guard";

@Authenticate(SessionGuard)
@TableController(ordersTable, "db/tables/orders")
export class OrdersController extends AsDbController<typeof OrdersTable> {}
