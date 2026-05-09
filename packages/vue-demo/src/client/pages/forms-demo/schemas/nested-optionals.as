@meta.label 'Nested Optional Structs'
@meta.description 'Cascading optional structs at five depths. Each "Add <label>" reveals the next level. Use this to verify the dashed-island placeholder layout, the section/island chrome alternation, and the auto-expand-and-focus flow as you drill in.'
@ui.form.submit.text 'Save'
export interface NestedOptionalsForm {
    @meta.label 'Profile Name'
    @ui.form.placeholder 'Acme partner integration'
    @meta.required 'Profile name is required'
    name: string

    @meta.label 'Address'
    @meta.description 'Postal address. The whole struct is optional — click Add Address to start filling it in.'
    address?: {
        @meta.label 'Street'
        @ui.form.placeholder '123 Main St'
        @meta.required 'Street is required'
        street: string

        @meta.label 'City'
        @ui.form.placeholder 'San Francisco'
        @meta.required 'City is required'
        @ui.form.grid.colSpan '6'
        city: string

        @meta.label 'ZIP'
        @ui.form.placeholder '94158'
        @ui.form.grid.colSpan '6'
        zip?: string

        @meta.label 'Geo'
        @meta.description 'Latitude/longitude with optional precision metadata.'
        geo?: {
            @meta.label 'Latitude'
            @ui.type 'number'
            @expect.min -90, 'Latitude must be ≥ -90'
            @expect.max 90, 'Latitude must be ≤ 90'
            @ui.form.grid.colSpan '6'
            lat: number

            @meta.label 'Longitude'
            @ui.type 'number'
            @expect.min -180, 'Longitude must be ≥ -180'
            @expect.max 180, 'Longitude must be ≤ 180'
            @ui.form.grid.colSpan '6'
            lng: number

            @meta.label 'Precision'
            @meta.description 'Accuracy metadata for the coordinates above.'
            precision?: {
                @meta.label 'Radius (m)'
                @ui.type 'number'
                @expect.min 0, '0 or greater'
                @ui.form.grid.colSpan '6'
                radiusM: number

                @meta.label 'Source'
                @ui.form.options 'GPS', 'gps'
                @ui.form.options 'Manual entry', 'manual'
                @ui.form.options 'IP geolocation', 'ip'
                @ui.form.grid.colSpan '6'
                source?: ui.select

                @meta.label 'Audit'
                @meta.description 'Who captured the precision data and when.'
                audit?: {
                    @meta.label 'Captured by'
                    @ui.form.placeholder 'jane@acme.com'
                    @meta.required 'Captured-by is required'
                    capturedBy: string

                    @meta.label 'Notes'
                    @ui.type 'textarea'
                    @ui.form.placeholder 'Additional context about how this was measured.'
                    notes?: string

                    @meta.label 'Timestamps'
                    @meta.description 'Created / updated audit trail.'
                    timestamps?: {
                        @meta.label 'Created (ISO)'
                        @ui.form.placeholder '2026-01-15T10:30:00Z'
                        @meta.required 'Created timestamp is required'
                        @ui.form.grid.colSpan '6'
                        created: string

                        @meta.label 'Updated (ISO)'
                        @ui.form.placeholder '2026-01-16T11:45:00Z'
                        @ui.form.grid.colSpan '6'
                        updated?: string
                    }
                }
            }
        }
    }

    @meta.label 'Notes'
    @ui.type 'textarea'
    @ui.form.placeholder 'Free-form notes attached to the profile.'
    notes?: string
}
