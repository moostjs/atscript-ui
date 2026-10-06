import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@aooth/arbac-moost";
import { attributeValuesTable } from "../db";
import type { AttributeValuesTable } from "../schemas/attribute-values.as";
import { SessionGuard } from "../auth/session.guard";
import { DemoArbacDbController } from "../auth/arbac-db.controller";

/** Dictionary behind `@ui.valueHelp` bindings (products' colour / size). */
@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("attribute_values")
@TableController(attributeValuesTable, "db/tables/attribute-values")
export class AttributeValuesController extends DemoArbacDbController<typeof AttributeValuesTable> {}
