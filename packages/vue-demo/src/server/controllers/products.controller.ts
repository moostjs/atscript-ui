import {
  TableController,
  DbAction,
  DbActionPK,
  DbRowActions,
  DbTableActions,
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
  @DbAction("publish", {
    label: "Publish",
    icon: "i-as-check",
    intent: "positive",
  })
  @ArbacAction("update")
  async publish(@DbActionPK() id: number) {
    const row = await productsTable.findById(id);
    if (!row) return { ok: false, id, message: `Product ${id} not found` };
    if (row.publishedAt) {
      return { ok: false, id, message: `Product ${id} is already published` };
    }
    await productsTable.updateOne({ id, publishedAt: Date.now() });
    return { ok: true, id, message: `Product ${id} published` };
  }

  @Post("actions/unpublish")
  @DbAction("unpublish", {
    label: "Unpublish",
    icon: "i-as-close",
    intent: "secondary",
  })
  @ArbacAction("update")
  async unpublish(@DbActionPK() id: number) {
    const row = await productsTable.findById(id);
    if (!row) return { ok: false, id, message: `Product ${id} not found` };
    if (!row.publishedAt) {
      return { ok: false, id, message: `Product ${id} is not published` };
    }
    await productsTable.updateOne({ id, publishedAt: undefined });
    return { ok: true, id, message: `Product ${id} unpublished` };
  }

  @Post("actions/duplicate")
  @DbAction("duplicate", {
    label: "Duplicate",
    icon: "i-as-plus",
    intent: "primary",
  })
  @ArbacAction("update")
  async duplicate(@DbActionPK() id: number) {
    const row = await productsTable.findById(id);
    if (!row) return { ok: false, id, message: `Product ${id} not found` };
    const { id: _omitId, sku, name, ...rest } = row;
    await productsTable.insertOne({
      ...rest,
      name: `Copy of ${name}`,
      sku: `${sku}-COPY-${Date.now().toString(36)}`,
      publishedAt: undefined,
    });
    return { ok: true, id, message: `Duplicated product ${id}` };
  }
}
