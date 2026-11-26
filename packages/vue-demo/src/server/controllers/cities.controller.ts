import { TableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@aooth/arbac-moost";
import { citiesTable } from "../db";
import type { CitiesTable } from "../schemas/cities.as";
import { SessionGuard } from "../auth/session.guard";
import { DemoArbacDbController } from "../auth/arbac-db.controller";

/** Dictionary behind the offices' city picker. */
@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("cities")
@TableController(citiesTable, "db/tables/cities")
export class CitiesController extends DemoArbacDbController<typeof CitiesTable> {}
