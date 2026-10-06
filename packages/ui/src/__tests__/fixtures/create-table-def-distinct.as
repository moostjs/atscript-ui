@db.table 'customers'
@db.http.path '/customers'
export interface DistinctCustomer {
    @meta.id
    id: number

    @ui.valueHelp.distinct
    city?: string

    @ui.valueHelp.distinct
    country?: string

    /// no opt-in annotation
    region?: string

    @ui.valueHelp.distinct
    tier: 'gold' | 'silver'
}

/// Plain interface declared by a controller as its display-only decorations
export interface CustomerDecorations {
    @meta.label 'Unread'
    @ui.table.width '6em'
    unreadCount?: number.int

    ownerName?: string

    @ui.table.exclude
    hidden?: string

    details: {
        a: string
    }
}
