import { TableController, AsDbController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { productsTable } from "../db";
import type { ProductsTable } from "../schemas/products.as";
import { SessionGuard } from "../auth/session.guard";

@Authenticate(SessionGuard)
@TableController(productsTable, "db/tables/products")
export class ProductsController extends AsDbController<typeof ProductsTable> {}
