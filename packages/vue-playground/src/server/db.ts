import { createAdapter } from "@atscript/db-sqlite";
import { ProductsTable } from "./schemas/products.as";
import { CustomersTable } from "./schemas/customers.as";
import { OrdersTable } from "./schemas/orders.as";

export const db = createAdapter(".data/playground.db");

export const productsTable = db.getTable(ProductsTable);
export const customersTable = db.getTable(CustomersTable);
export const ordersTable = db.getTable(OrdersTable);
