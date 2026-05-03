/**
 * Wire shape of `GET /capabilities?app=X&tableKey=Y`. Validated by
 * `@atscript/moost-validator` (registered globally on the host app), so a
 * malformed request gets a 400 with structured field errors before the
 * handler runs — no manual `missing_scope` checks in the route body.
 *
 * Length bounds mirror the same-named columns on `AsPresetEntry` so the
 * client cannot pin a scope the row schema would later reject.
 */
export interface AsCapabilitiesQuery {
    @expect.maxLength 128
    @expect.minLength 1
    app: string

    @expect.maxLength 64
    @expect.minLength 1
    tableKey: string
}
