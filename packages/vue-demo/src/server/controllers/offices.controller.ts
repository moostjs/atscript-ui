import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@aooth/arbac-moost";
import { officesTable } from "../db";
import type { OfficesTable } from "../schemas/offices.as";
import { SessionGuard } from "../auth/session.guard";
import { DemoArbacDbController } from "../auth/arbac-db.controller";

/** Offices: a city code shown with its name. */
@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("offices")
@TableController(officesTable, "db/tables/offices")
export class OfficesController extends DemoArbacDbController<typeof OfficesTable> {}
