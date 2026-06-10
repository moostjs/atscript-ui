import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@aooth/arbac-moost";
import { categoriesTable } from "../db";
import type { CategoriesTable } from "../schemas/categories.as";
import { SessionGuard } from "../auth/session.guard";
import { DemoArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("categories")
@TableController(categoriesTable, "db/tables/categories")
export class CategoriesController extends DemoArbacDbController<typeof CategoriesTable> {}
