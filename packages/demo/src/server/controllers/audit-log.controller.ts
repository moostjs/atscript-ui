import { ReadableController, AsDbReadableController } from "@atscript/moost-db";
import { Authenticate } from "@moostjs/event-http";
import { auditLogTable } from "../db";
import type { AuditLogTable } from "../schemas/audit-log.as";
import { SessionGuard } from "../auth/session.guard";

@Authenticate(SessionGuard)
@ReadableController(auditLogTable, "db/tables/audit_log")
export class AuditLogController extends AsDbReadableController<typeof AuditLogTable> {}
