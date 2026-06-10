import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { AsArbacDbReadableController } from "@aooth/arbac-moost";
import { Inherit } from "moost";
import type { TMetaResponse } from "@atscript/db";
import { narrowMetaFields, requestScopes } from "./arbac-db.controller";

/**
 * Read-only variant of `DemoArbacDbController` for resources that are not
 * writable (e.g. audit_log view). Upstream supplies filter / projection /
 * controls enforcement; locally we only narrow `/meta` fields by the
 * per-request column scope.
 */
@Inherit()
export class DemoArbacDbReadableController<
  T extends TAtscriptAnnotatedType = TAtscriptAnnotatedType,
> extends AsArbacDbReadableController<T> {
  protected override async applyMetaOverlay(meta: TMetaResponse): Promise<TMetaResponse> {
    return narrowMetaFields(await super.applyMetaOverlay(meta), requestScopes());
  }
}
