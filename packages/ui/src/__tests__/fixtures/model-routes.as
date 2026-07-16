/// Fixtures for buildModelRoutes()

/// Table with a string name + explicit label; no nav annotations
@meta.label 'People'
@db.table 'users'
export interface NavUsers {
    @meta.id
    id: number

    name: string
}

/// `@db.http.path` wins over the `@db.table` name; grouped + ordered
@db.table 'orders'
@db.http.path 'db/tables/orders'
@ui.nav.group 'Sales'
@ui.nav.order 1
export interface NavOrders {
    @meta.id
    id: number

    total: number
}

/// External view (string arg) — kind must be "view"
@meta.label 'Sales Report'
@db.view 'sales_report'
@ui.nav.order 2
export interface NavSalesReport {
    @meta.id
    id: number

    amount: number
}

/// Hidden from generated navigation but still returned by the helper;
/// http path exercises leading/trailing slash normalization
@db.table 'audit_log'
@db.http.path '/db/tables/audit/'
@ui.nav.hidden
export interface NavAudit {
    @meta.id
    id: number

    event: string
}

/// Bare `@db.table` — path falls back to the type id as-is
@db.table
export interface NavProducts {
    @meta.id
    id: number

    title: string
}

/// Not a DB entity — must be skipped
export interface NavPlain {
    id: number
}
