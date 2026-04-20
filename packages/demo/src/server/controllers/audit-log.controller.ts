import { ReadableController, AsDbReadableController } from "@atscript/moost-db";
import { auditLogTable } from "../db";
import type { AuditLogTable } from "../schemas/audit-log.as";

@ReadableController(auditLogTable, "db/tables/audit_log")
export class AuditLogController extends AsDbReadableController<typeof AuditLogTable> {}
