import { Controller } from "moost";
import { Post, Body, HttpError, Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource, ArbacAction } from "@moostjs/arbac";
import { ordersTable } from "../db";
import { SessionGuard } from "../auth/session.guard";

interface BulkCancelBody {
  ids: number[];
}

@Controller("actions/orders")
@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("orders")
export class OrdersActionsController {
  @Post("bulk-cancel")
  @ArbacAction("update")
  async bulkCancel(@Body() body: BulkCancelBody) {
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (ids.length === 0) throw new HttpError(400, "ids must be a non-empty array");
    const selected = await ordersTable.findMany({ filter: { id: { $in: ids } } });
    const delivered = selected.filter((o) => o.status === "delivered");
    if (delivered.length > 0) {
      throw new HttpError(
        500,
        `Cannot cancel delivered orders: ${delivered.map((d) => d.id).join(", ")}`,
      );
    }
    await ordersTable.updateMany({ id: { $in: ids } }, { status: "cancelled" });
    return { cancelled: ids };
  }
}
