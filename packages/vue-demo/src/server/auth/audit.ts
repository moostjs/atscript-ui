import { defineInterceptor, TInterceptorPriority, useControllerContext } from "moost";
import { useArbac } from "@moostjs/arbac";
import { auditLogTable } from "../db";
import { MOOST_DB_ACTION } from "./arbac-db.controller";
import { useSession } from "./use-session";

interface ActionMeta {
  name: string;
  opts: { level?: "row" | "rows" | "table"; default?: boolean };
}

interface ActionResponse {
  ok?: boolean;
  message?: string;
  id?: number | string;
  ids?: Array<number | string>;
}

export const auditInterceptor = defineInterceptor(
  {
    // Fire-and-forget: audit writes are not on the action response's critical
    // path. Errors are swallowed (logged) rather than failing the request.
    after(response) {
      const action = methodAction();
      if (!action) return;
      const r = (response as ActionResponse) ?? {};
      // `{ ok: false, message }` from a guard miss (e.g. cancel-on-delivered)
      // is logged as `<name>.rejected` to capture attempted-but-blocked ops.
      const label = r.ok !== false ? action.name : `${action.name}.rejected`;
      void writeRows(action, r, label, r.message).catch(logAuditError);
    },
    error(err) {
      const action = methodAction();
      if (!action) return;
      const message = err instanceof Error ? err.message : String(err);
      void writeRows(action, {}, `${action.name}.failed`, message).catch(logAuditError);
    },
  },
  TInterceptorPriority.AFTER_ALL,
);

function logAuditError(err: unknown) {
  console.error("[audit] failed to write log row", err);
}

function methodAction(): ActionMeta | undefined {
  const meta = useControllerContext().getMethodMeta() as
    | (Record<string, unknown> & { [MOOST_DB_ACTION]?: ActionMeta })
    | undefined;
  const m = meta?.[MOOST_DB_ACTION];
  return m?.name ? m : undefined;
}

async function writeRows(
  action: ActionMeta,
  response: ActionResponse,
  actionLabel: string,
  message: string | undefined,
) {
  const session = useSession();
  const actorId = session?.userId ?? 0;
  const resource = useArbac().resource ?? "?";
  const ids = response.ids && response.ids.length > 0 ? response.ids : [response.id ?? 0];
  const changes = JSON.stringify({
    level: action.opts.level ?? "row",
    message,
    response,
  });
  await auditLogTable.insertMany(
    ids.map((id) => ({
      actorId,
      entityType: resource,
      entityId: typeof id === "number" ? id : Number(id) || 0,
      action: actionLabel,
      changes,
    })),
  );
}
