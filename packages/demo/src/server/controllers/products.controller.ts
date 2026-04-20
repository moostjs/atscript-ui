import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@moostjs/arbac";
import { productsTable } from "../db";
import type { ProductsTable } from "../schemas/products.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("products")
@TableController(productsTable, "db/tables/products")
export class ProductsController extends AsArbacDbController<typeof ProductsTable> {}
