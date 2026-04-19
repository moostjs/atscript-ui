import { Intercept } from "moost";
import { TableController, AsDbController } from "@atscript/moost-db";
import { productsTable } from "../db";
import type { ProductsTable } from "../schemas/products.as";
import { latencyInterceptor } from "../interceptors/latency";

@Intercept(latencyInterceptor)
@TableController(productsTable, "db/tables/products")
export class ProductsController extends AsDbController<typeof ProductsTable> {}
