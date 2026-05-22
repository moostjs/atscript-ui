/// Minimal single-PK interface for `create-table-def-actions.spec.ts` —
/// the action-grouping tests only need ONE field on the type; what they
/// vary is the `actions` and `crud` shape of the `MetaResponse` literal.
export interface SimpleIdTable {
    @meta.id
    id: string
}
