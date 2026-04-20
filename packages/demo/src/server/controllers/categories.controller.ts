import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@moostjs/arbac";
import { categoriesTable } from "../db";
import type { CategoriesTable } from "../schemas/categories.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("categories")
@TableController(categoriesTable, "db/tables/categories")
export class CategoriesController extends AsArbacDbController<typeof CategoriesTable> {}
