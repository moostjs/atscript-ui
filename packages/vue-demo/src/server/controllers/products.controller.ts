import {
  TableController,
  DbAction,
  DbActionID,
  DbActionRow,
  DbRowActions,
  DbTableActions,
  perRow,
} from "@atscript/moost-db";
import { Post, Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource, ArbacAction } from "@moostjs/arbac";
import { productsTable } from "../db";
import type { ProductsTable } from "../schemas/products.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbController } from "../auth/arbac-db.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("products")
@TableController(productsTable, "db/tables/products")
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
  edit: {
    processor: "navigate",
    label: "Edit",
    icon: "i-as-arrow-up",
    value: "/products/$1/edit",
    intent: "secondary",
    default: true,
  },
})
export class ProductsController extends AsArbacDbController<typeof ProductsTable> {
  /** Sets `publishedAt = now` if currently null. */
  @Post("actions/publish")
  @DbAction<typeof ProductsTable, ["id", "sku", "publishedAt"]>("publish", {
    label: "Publish",
    icon: "i-as-check",
    intent: "positive",
    requiredFields: ["id", "sku", "publishedAt"],
    disabled: perRow((p) => p.publishedAt != null),
  })
  @ArbacAction("update")
  async publish(@DbActionRow() row: { id: number; sku: string; publishedAt?: number }) {
    await productsTable.updateOne({ id: row.id, publishedAt: Date.now() });
    return { ok: true, id: row.id, message: `Product ${row.sku} published` };
  }

  @Post("actions/unpublish")
  @DbAction<typeof ProductsTable, ["id", "sku", "publishedAt"]>("unpublish", {
    label: "Unpublish",
    icon: "i-as-close",
    intent: "secondary",
    requiredFields: ["id", "sku", "publishedAt"],
    disabled: perRow((p) => p.publishedAt == null),
  })
  @ArbacAction("update")
  async unpublish(@DbActionRow() row: { id: number; sku: string; publishedAt?: number }) {
    await productsTable.updateOne({ id: row.id, publishedAt: undefined });
    return { ok: true, id: row.id, message: `Product ${row.sku} unpublished` };
  }

  @Post("actions/duplicate")
  @DbAction("duplicate", {
    label: "Duplicate",
    icon: "i-as-plus",
    intent: "primary",
  })
  @ArbacAction("update")
  async duplicate(@DbActionID() id: Record<string, unknown>) {
    // `duplicate` needs the FULL row (every column for the clone), so the
    // gate-loaded projection isn't enough — fetch directly. Identifier shape
    // varies with `meta.preferredId` (PK vs SKU); findOne handles both.
    const row = await productsTable.findOne({ filter: id as never });
    if (!row) return { ok: false, message: `Product not found` };
    const { id: _omitId, sku, name, ...rest } = row;
    await productsTable.insertOne({
      ...rest,
      name: `Copy of ${name}`,
      sku: `${sku}-COPY-${Date.now().toString(36)}`,
      publishedAt: undefined,
    });
    return { ok: true, id: row.id, message: `Duplicated product ${row.sku}` };
  }
}
