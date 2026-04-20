import { createAdapter } from "@atscript/db-sqlite";

export const db = createAdapter(".data/demo.db");
// P1 adds table refs here, e.g.:
//   export const usersTable = db.getTable(UsersTable)
