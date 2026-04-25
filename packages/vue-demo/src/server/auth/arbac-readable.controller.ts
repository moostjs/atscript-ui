import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { AsDbReadableController } from "@atscript/moost-db";
import { useArbac } from "@moostjs/arbac";
import { Inherit } from "moost";
import type { UniqueryControls } from "@atscript/db";
import type { DemoScope } from "./arbac-scope";
import { narrowProjection, unionAllowedColumns } from "./arbac-db.controller";

/**
 * Read-only variant of `AsArbacDbController` for resources that are not writable
 * (e.g. audit_log view). Shares the column-scope logic; only the read hooks
 * (`transformProjection` and `meta`) are overridden.
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

  override async meta() {
    const raw = await super.meta();
    const allowed = this.allowedColumns();
    if (!allowed) return raw;
    const fields: Record<string, { sortable: boolean; filterable: boolean }> = {};
    for (const k of Object.keys(raw.fields)) {
      if (allowed.includes(k)) fields[k] = raw.fields[k];
    }
    return { ...raw, fields };
  }
}
