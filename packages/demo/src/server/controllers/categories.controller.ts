import { TableController, AsDbController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { categoriesTable } from "../db";
import type { CategoriesTable } from "../schemas/categories.as";
import { SessionGuard } from "../auth/session.guard";

@Authenticate(SessionGuard)
@TableController(categoriesTable, "db/tables/categories")
export class CategoriesController extends AsDbController<typeof CategoriesTable> {}
