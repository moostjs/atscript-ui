import { createAdapter } from "@atscript/db-sqlite";
import { UsersTable } from "./schemas/users.as";
import { RolesTable } from "./schemas/roles.as";
import { CategoriesTable } from "./schemas/categories.as";
import { ProductsTable } from "./schemas/products.as";
import { CustomersTable } from "./schemas/customers.as";
import { OrdersTable } from "./schemas/orders.as";
import { AuditLogTable } from "./schemas/audit-log.as";

export const db = createAdapter(".data/demo.db");

export const usersTable = db.getTable(UsersTable);
export const rolesTable = db.getTable(RolesTable);
export const categoriesTable = db.getTable(CategoriesTable);
export const productsTable = db.getTable(ProductsTable);
export const customersTable = db.getTable(CustomersTable);
export const ordersTable = db.getTable(OrdersTable);
export const auditLogTable = db.getTable(AuditLogTable);
