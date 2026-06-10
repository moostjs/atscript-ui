import { ReadableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { ArbacAuthorize, ArbacResource } from "@aooth/arbac-moost";
import { auditLogTable } from "../db";
import type { AuditLogTable } from "../schemas/audit-log.as";
import { SessionGuard } from "../auth/session.guard";
import { DemoArbacDbReadableController } from "../auth/arbac-readable.controller";

@Authenticate(SessionGuard)
@ArbacAuthorize()
@ArbacResource("audit_log")
@ReadableController(auditLogTable, "db/tables/audit_log")
export class AuditLogController extends DemoArbacDbReadableController<typeof AuditLogTable> {}
