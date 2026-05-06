import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { AsDbReadableController } from "@atscript/moost-db";
import { useArbac } from "@moostjs/arbac";
import { Inherit } from "moost";
import type { TMetaResponse, UniqueryControls } from "@atscript/db";
import type { DemoScope } from "./arbac-scope";
import { narrowProjection, unionAllowedColumns } from "./arbac-db.controller";

/**
 * Read-only variant of `AsArbacDbController` for resources that are not writable
 * (e.g. audit_log view). Shares the column-scope logic; only the read hooks
 * (`transformProjection` and `applyMetaOverlay`) are overridden.
 *
 * No CRUD/action gating is needed here — readable controllers expose only
 * reads in `crud` (`query` / `pages` / `one`) and never declare `@DbAction`
 * handlers, so all that's left is field narrowing under the same per-request
 * column scope used by {@link transformProjection}.
 */
@Inherit()
export class AsArbacDbReadableController<
  T extends TAtscriptAnnotatedType = TAtscriptAnnotatedType,
> extends AsDbReadableController<T> {
  protected scopes(): DemoScope[] {
    const scopes = useArbac<DemoScope>().getScopes?.();
    return (scopes ?? []) as DemoScope[];
  }

  protected allowedColumns(): string[] | undefined {
    return unionAllowedColumns(this.scopes());
  }

  protected override transformProjection(
    projection?: UniqueryControls["$select"],
  ): UniqueryControls["$select"] | undefined {
    return narrowProjection(this.scopes(), projection);
  }

  protected override applyMetaOverlay(meta: TMetaResponse): TMetaResponse {
    const arbac = useArbac<DemoScope>();
    if (arbac.isPublic) return meta;
    const allowed = this.allowedColumns();
    if (!allowed) return meta;
    const fields: Record<string, { sortable: boolean; filterable: boolean }> = {};
    for (const k of Object.keys(meta.fields)) {
      if (allowed.includes(k)) fields[k] = meta.fields[k];
    }
    return { ...meta, fields };
  }
}
