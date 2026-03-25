import { TableController, AsDbController } from "@atscript/moost-db";
import { ordersTable } from "../db";
import type { OrdersTable } from "../schemas/orders.as";

@TableController(ordersTable, "db/tables/orders")
export class OrdersController extends AsDbController<typeof OrdersTable> {}
