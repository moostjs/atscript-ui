import { ReadableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@moostjs/arbac";
import { wfStateTable } from "../db";
import type { WfStateRow } from "../schemas/wf-state.as";
import { SessionGuard } from "../auth/session.guard";
import { AsArbacDbReadableController } from "../auth/arbac-readable.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("wf_states")
@ReadableController(wfStateTable, "db/tables/wf_states")
export class WfStatesController extends AsArbacDbReadableController<typeof WfStateRow> {}
