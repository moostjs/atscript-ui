// Named-type aliases so the @ui.type annotation can ride along into tuples + arrays.
@meta.label 'Date'
@ui.type 'date'
type DateString = string

@meta.label 'Time'
@ui.type 'time'
type TimeString = string

@meta.label 'Dates Showcase'
@meta.description 'Date, datetime, and time inputs across required/optional and string vs epoch-ms storage shapes.'
@ui.form.submit.text 'Save'
export interface DatesShowcaseForm {
    // ── Required date, string storage ────────────────────────
    @meta.label 'Birth date'
    @meta.description 'String storage (YYYY-MM-DD). Required for submit validation.'
    @ui.type 'date'
    @meta.required 'Birth date is required'
    @ui.form.prefix.icon 'i-as-check-square'
    @ui.form.grid.colSpan '6'
    birthDate: string

    // ── Optional date, epoch-ms storage ──────────────────────
    @meta.label 'Event date'
    @meta.description 'Epoch-ms storage (number.timestamp) with explicit date picker override.'
    @ui.type 'date'
    @ui.form.grid.colSpan '6'
    eventDate?: number.timestamp

    // ── Default datetime (no explicit override) ──────────────
    @meta.label 'Meeting at'
    @meta.description 'number.timestamp defaults to datetime renderer — no @ui.type override needed.'
    @ui.form.grid.colSpan '6'
    meetingAt?: number.timestamp

    // ── Explicit datetime, string storage ────────────────────
    @meta.label 'Appointment'
    @meta.description 'Datetime picker, string storage (YYYY-MM-DDTHH:mm).'
    @ui.type 'datetime'
    @ui.form.grid.colSpan '6'
    appointment?: string

    // ── Time inputs (required + optional) ────────────────────
    @meta.label 'Opening time'
    @meta.description 'Optional time picker (HH:mm). Always string storage.'
    @ui.type 'time'
    @ui.form.grid.colSpan '6'
    openingTime?: string

    @meta.label 'Closing time'
    @meta.description 'Required time field for validation flow.'
    @ui.type 'time'
    @meta.required 'Closing time is required'
    @ui.form.grid.colSpan '6'
    closingTime: string

    // ── Tuple [start, end] using the DateString alias ────────
    @meta.label 'Date range'
    @meta.description 'Tuple of two dates — start/end picker. Optional.'
    range?: [DateString, DateString]

    // ── Array of dates via named-type alias ──────────────────
    @meta.label 'Milestones'
    @meta.description 'Optional array of dates (string storage).'
    @ui.form.label.singular 'milestone'
    milestones?: DateString[]
}
