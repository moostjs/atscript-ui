import { TableController, AsDbController } from "@atscript/moost-db";
import { categoriesTable } from "../db";
import type { CategoriesTable } from "../schemas/categories.as";

@TableController(categoriesTable, "db/tables/categories")
export class CategoriesController extends AsDbController<typeof CategoriesTable> {}
