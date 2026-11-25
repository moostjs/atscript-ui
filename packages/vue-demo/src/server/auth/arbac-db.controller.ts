import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { getProjectionMode, isFieldAllowed, unionProjections } from "@aooth/arbac";
import type { ArbacDbScope } from "@aooth/arbac-moost";
import { AsArbacDbController, useArbac } from "@aooth/arbac-moost";
import { Inherit } from "moost";
import type { TMetaResponse } from "@atscript/db";

/**
 * Narrow `meta.fields` by the union of the per-request scope projections.
 *
 * The upstream `AsArbacDbController.applyMetaOverlay` gates `actions[]` and
 * `crud` but leaves `fields` untouched; the demo UI builds its column set
 * from `/meta`, so a viewer must not even see `password` / `salt` listed
 * (e2e section 20.3). No scopes (public route / direct test instantiation)
 * or a universe projection → envelope unchanged.
 */
export function narrowMetaFields(meta: TMetaResponse, scopes: ArbacDbScope[]): TMetaResponse {
  if (!scopes.length) return meta;
  const union = unionProjections(...scopes.map((s) => s.projection ?? {}));
  if (getProjectionMode(union) === "empty") return meta;
  const fields: TMetaResponse["fields"] = {};
  for (const k of Object.keys(meta.fields)) {
    if (isFieldAllowed(k, union)) fields[k] = meta.fields[k];
  }
  return { ...meta, fields };
}

/** Per-request scopes as cached by the `ArbacAuthorize` interceptor. */
export function requestScopes(): ArbacDbScope[] {
  return useArbac().getScopes<ArbacDbScope>() ?? [];
}

/**
 * Demo overlay on `@aooth/arbac-moost`'s `AsArbacDbController`: scope
 * filters, projection narrowing, write-payload stripping, and action/crud
 * gating all come from upstream. Apply `@ArbacAuthorize()` +
 * `@ArbacResource("<table>")` at the class level; the interceptor populates
 * scopes per request. Locally we only add `/meta` field narrowing.
 */
@Inherit()
export class DemoArbacDbController<
  T extends TAtscriptAnnotatedType = TAtscriptAnnotatedType,
> extends AsArbacDbController<T> {
  protected override async applyMetaOverlay(meta: TMetaResponse): Promise<TMetaResponse> {
    return narrowMetaFields(await super.applyMetaOverlay(meta), requestScopes());
  }
}
