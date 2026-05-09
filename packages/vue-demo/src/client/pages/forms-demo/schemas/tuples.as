@meta.label 'Latitude'
@ui.form.grid.colSpan '4'
type Latitude = number

@meta.label 'Longitude'
@ui.form.grid.colSpan '4'
type Longitude = number

@meta.label 'Tuples Showcase'
@meta.description 'Fixed-length, position-typed tuples. Required tuples auto-fill on mount; optional tuples show the Add placeholder until enabled.'
@ui.form.submit.text 'Save'
export interface TuplesShowcaseForm {
    // ── Required tuple, no labels (positions render as #1, #2) ──
    @meta.label 'RGB color'
    @meta.description 'Required tuple of three numbers — auto-fills with defaults on mount.'
    rgb: [number, number, number]

    // ── Required tuple with labeled positions ──
    @meta.label 'Coordinates'
    @meta.description 'Required tuple — each position labeled via @meta.label on a named type.'
    coords: [Latitude, Longitude]

    // ── Optional tuple ──
    @meta.label 'Origin'
    @meta.description 'Optional tuple — empty placeholder until the user clicks Add Origin.'
    origin?: [Latitude, Longitude]

    // ── Mixed-type tuple ──
    @meta.label 'Setting tuple'
    @meta.description 'Mixed-type tuple [string, number, boolean]. Falls back to indexed labels.'
    settings: [string, number, boolean]
}
