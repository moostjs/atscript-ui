// Fixture for the live error aggregation (descendant error-count badges).
// A required leaf nested one level down, so tests can assert counts on the
// leaf path AND its ancestor section path.

@meta.label 'Info'
type LiveInfoSection = {
    @meta.required 'Name is required'
    name: string
}

export interface LiveErrorForm {
    info: LiveInfoSection
}
