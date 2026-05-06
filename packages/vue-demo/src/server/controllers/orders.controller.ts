import {
  TableController,
  DbAction,
  DbActionID,
  DbActionIDs,
  DbRowActions,
  DbTableActions,
  InputForm,
  perRow,
} from "@atscript/moost-db";
import { Post, Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource, ArbacAction } from "@moostjs/arbac";
import { ordersTable } from "../db";
import type { OrdersTable } from "../schemas/orders.as";
import { CancelOrdersInput } from "../schemas/action-forms.as";
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
  @DbAction<typeof OrdersTable, ["status"]>("process", {
    label: "Process",
    icon: "i-as-refresh",
    intent: "primary",
    requiredFields: ["status"],
    disabled: perRow((o) => o.status !== "pending"),
  })
  @ArbacAction("update")
  async processOrder(@DbActionID() id: { id: number }) {
    await ordersTable.updateOne({ id: id.id, status: "processing" });
    return { ok: true, id: id.id, message: `Order ${id.id} → processing` };
  }

  /** `processing` → `shipped`. Sets `shippedAt`. */
  @Post("actions/ship")
  @DbAction<typeof OrdersTable, ["status"]>("ship", {
    label: "Ship",
    icon: "i-as-arrow-up",
    intent: "primary",
    requiredFields: ["status"],
    disabled: perRow((o) => o.status !== "processing"),
  })
  @ArbacAction("update")
  async shipOrder(@DbActionID() id: { id: number }) {
    await ordersTable.updateOne({ id: id.id, status: "shipped", shippedAt: Date.now() });
    return { ok: true, id: id.id, message: `Order ${id.id} shipped` };
  }

  /** `shipped` → `delivered`. */
  @Post("actions/mark-delivered")
  @DbAction<typeof OrdersTable, ["status"]>("mark-delivered", {
    label: "Mark delivered",
    icon: "i-as-check",
    intent: "positive",
    requiredFields: ["status"],
    disabled: perRow((o) => o.status !== "shipped"),
  })
  @ArbacAction("update")
  async markDelivered(@DbActionID() id: { id: number }) {
    await ordersTable.updateOne({ id: id.id, status: "delivered" });
    return { ok: true, id: id.id, message: `Order ${id.id} → delivered` };
  }

  /**
   * Cancel one or more orders. `@DbActionIDs` infers `level: 'rows'`; the
   * cell dropdown wraps a single id into `[{id}]` so this same handler
   * covers per-row and toolbar bulk paths. The gate filters out
   * delivered/cancelled rows; zero survivors → friendly toast.
   */
  @Post("actions/cancel")
  @DbAction<typeof OrdersTable, ["status"]>("cancel", {
    label: "Cancel",
    icon: "i-as-close",
    intent: "negative",
    description: "Delivered and already-cancelled rows are skipped.",
    requiredFields: ["status"],
    disabled: perRow((o) => o.status === "delivered" || o.status === "cancelled"),
    onDisabledRows: "skip",
    // No `promptText`: the action declares `@InputForm(CancelOrdersInput)`,
    // so `triggerAction()` short-circuits to the form-dialog path and any
    // `promptText` would be unreachable.
  })
  @ArbacAction("update")
  async cancel(
    @DbActionIDs() ids: { id: number }[],
    @InputForm(CancelOrdersInput) input: CancelOrdersInput,
  ) {
    const targetIds = ids.map((o) => o.id);
    if (targetIds.length === 0) {
      return { ok: false, ids: [], message: "No cancellable orders selected." };
    }
    await ordersTable.updateMany({ id: { $in: targetIds } }, { status: "cancelled" });
    const refund = input?.refund !== false ? " Refunds queued." : "";
    return {
      ok: true,
      ids: targetIds,
      message: `Cancelled ${targetIds.length} order${targetIds.length === 1 ? "" : "s"} (${input?.reason}).${refund}`,
    };
  }
}
