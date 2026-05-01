import { DbRowActions, TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@moostjs/arbac";
import { customersTable } from "../db";
import type { CustomersTable } from "../schemas/customers.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("customers")
@TableController(customersTable, "db/tables/customers")
@DbRowActions({
  // Single label-only row action — no `icon` field. Demonstrates the
  // `<AsRowActions>` text-only render path: the row cell shows a labelled
  // button instead of an icon-only button. Useful real-world admin pattern
  // (cross-table navigation: "show me this customer's orders").
  "view-orders": {
    processor: "navigate",
    label: "View orders",
    value: "/orders",
    default: true,
  },
})
export class CustomersController extends AsArbacDbController<typeof CustomersTable> {}
