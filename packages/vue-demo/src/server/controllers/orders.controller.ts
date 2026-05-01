import {
  TableController,
  DbAction,
  DbActionPK,
  DbActionPKs,
  DbRowActions,
  DbTableActions,
} from "@atscript/moost-db";
import { Post, Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource, ArbacAction } from "@moostjs/arbac";
import { ordersTable } from "../db";
import type { OrdersTable } from "../schemas/orders.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";

/**
 * Order lifecycle:
 *   pending → processing → shipped → delivered
 *                              └─→ cancelled (any non-delivered)
 *
 * Each transition is exposed as a `@DbAction` with a server-side status
 * guard. Misses return `{ ok: false, message }` (HTTP 200 with structured
 * body) so the UI shows a friendly toast; the audit interceptor logs both
 * success and rejection paths.
 */
@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("orders")
@TableController(ordersTable, "db/tables/orders")
@DbTableActions({
  "export-csv": {
    processor: "custom",
    label: "Export CSV",
    icon: "i-as-arrow-down",
    intent: "primary",
    description: "Trigger client-side export via @action event",
  },
})
@DbRowActions({
  open: {
    processor: "navigate",
    label: "Open",
    icon: "i-as-arrow-up",
    value: "/orders/$1/edit",
    intent: "secondary",
    default: true,
  },
})
export class OrdersController extends AsArbacDbController<typeof OrdersTable> {
  /** `pending` → `processing`. */
  @Post("actions/process")
  @DbAction("process", {
    label: "Process",
    icon: "i-as-refresh",
    intent: "primary",
  })
  @ArbacAction("update")
  async processOrder(@DbActionPK() id: number) {
    const row = await ordersTable.findById(id);
    if (!row) return { ok: false, id, message: `Order ${id} not found` };
    if (row.status !== "pending") {
      return { ok: false, id, message: `Order ${id} is ${row.status}, not pending` };
    }
    await ordersTable.updateOne({ id, status: "processing" });
    return { ok: true, id, message: `Order ${id} → processing` };
  }

  /** `processing` → `shipped`. Sets `shippedAt`. */
  @Post("actions/ship")
  @DbAction("ship", {
    label: "Ship",
    icon: "i-as-arrow-up",
    intent: "primary",
  })
  @ArbacAction("update")
  async shipOrder(@DbActionPK() id: number) {
    const row = await ordersTable.findById(id);
    if (!row) return { ok: false, id, message: `Order ${id} not found` };
    if (row.status !== "processing") {
      return { ok: false, id, message: `Order ${id} is ${row.status}, not processing` };
    }
    await ordersTable.updateOne({ id, status: "shipped", shippedAt: Date.now() });
    return { ok: true, id, message: `Order ${id} shipped` };
  }

  /** `shipped` → `delivered`. */
  @Post("actions/mark-delivered")
  @DbAction("mark-delivered", {
    label: "Mark delivered",
    icon: "i-as-check",
    intent: "positive",
  })
  @ArbacAction("update")
  async markDelivered(@DbActionPK() id: number) {
    const row = await ordersTable.findById(id);
    if (!row) return { ok: false, id, message: `Order ${id} not found` };
    if (row.status !== "shipped") {
      return { ok: false, id, message: `Order ${id} is ${row.status}, not shipped` };
    }
    await ordersTable.updateOne({ id, status: "delivered" });
    return { ok: true, id, message: `Order ${id} → delivered` };
  }

  /**
   * Cancel one or more orders. `@DbActionPKs` infers `level: 'rows'`; the
   * cell dropdown wraps a single pk into `[pk]` so this same handler covers
   * per-row and toolbar bulk paths. Delivered/cancelled rows are silently
   * filtered; zero survivors → friendly toast.
   */
  @Post("actions/cancel")
  @DbAction("cancel", {
    label: "Cancel",
    icon: "i-as-close",
    intent: "negative",
    promptText: "Cancel the selected order(s)? Delivered orders will be skipped.",
  })
  @ArbacAction("update")
  async cancel(@DbActionPKs() ids: number[]) {
    const selected = await ordersTable.findMany({ filter: { id: { $in: ids } } });
    const cancellableIds: number[] = [];
    let skippedCount = 0;
    for (const o of selected) {
      if (o.status === "delivered" || o.status === "cancelled") skippedCount++;
      else cancellableIds.push(o.id);
    }
    if (cancellableIds.length === 0) {
      return {
        ok: false,
        ids,
        message: `Nothing to cancel — ${skippedCount} order(s) already delivered or cancelled.`,
      };
    }
    await ordersTable.updateMany({ id: { $in: cancellableIds } }, { status: "cancelled" });
    return {
      ok: true,
      ids: cancellableIds,
      message: `Cancelled ${cancellableIds.length} order(s)${skippedCount ? `, skipped ${skippedCount}` : ""}.`,
    };
  }
}
