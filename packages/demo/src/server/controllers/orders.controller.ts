import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@moostjs/arbac";
import { ordersTable } from "../db";
import type { OrdersTable } from "../schemas/orders.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("orders")
@TableController(ordersTable, "db/tables/orders")
export class OrdersController extends AsArbacDbController<typeof OrdersTable> {}
