import { Intercept } from "moost";
import { TableController, AsDbController } from "@atscript/moost-db";
import { ordersTable } from "../db";
import type { OrdersTable } from "../schemas/orders.as";
import { latencyInterceptor } from "../interceptors/latency";

@Intercept(latencyInterceptor)
@TableController(ordersTable, "db/tables/orders")
export class OrdersController extends AsDbController<typeof OrdersTable> {}
