@meta.label 'Array Showcase'
@meta.description 'Every array variant in one form: optional and required, primitives and objects, plus a nested array.'
@ui.form.submit.text 'Save'
export interface ArrayShowcaseForm {
    // ── Optional array of primitives ────────────────────────
    @meta.label 'Tags'
    @meta.description 'Optional string array — collapsed to the Add placeholder when empty.'
    @ui.form.label.singular 'tag'
    tags?: string[]

    // ── Required array of primitives ────────────────────────
    @meta.label 'HTTP headers'
    @meta.description 'Required string array — opens with zero items and a footer Add button.'
    @ui.form.label.singular 'header'
    @expect.minLength 1, 'At least one header is required'
    headers: string[]

    // ── Optional array of objects ───────────────────────────
    @meta.label 'Contacts'
    @meta.description 'Optional object array — each item is its own card with a Remove button.'
    @ui.form.label.singular 'contact'
    contacts?: {
        @meta.label 'First name'
        @ui.form.placeholder 'Jane'
        @meta.required 'First name is required'
        @ui.form.grid.colSpan '6'
        firstName: string

        @meta.label 'Last name'
        @ui.form.placeholder 'Doe'
        @ui.form.grid.colSpan '6'
        lastName?: string

        @meta.label 'Email'
        @ui.form.placeholder 'jane@example.com'
        @meta.required 'Email is required'
        email: string.email
    }[]

    // ── Required array of objects ───────────────────────────
    @meta.label 'Phone numbers'
    @meta.description 'Required object array — at least one entry must be present.'
    @ui.form.label.singular 'phone'
    @expect.minLength 1, 'At least one phone is required'
    phones: {
        @meta.label 'Label'
        @ui.form.placeholder 'Mobile'
        @meta.required 'Label is required'
        @ui.form.grid.colSpan '4'
        label: string

        @meta.label 'Number'
        @ui.form.placeholder '+1 555 0100'
        @meta.required 'Number is required'
        @ui.form.grid.colSpan '8'
        number: string
    }[]

    // ── Nested array (array of objects, one field is itself an array) ──
    @meta.label 'Team'
    @meta.description 'Optional array of objects, each containing an inner optional members array.'
    @ui.form.label.singular 'team'
    team?: {
        @meta.label 'Team name'
        @ui.form.placeholder 'Platform'
        @meta.required 'Team name is required'
        name: string

        @meta.label 'Members'
        @ui.form.label.singular 'member'
        members?: string[]
    }[]

    // ── Multiselect: literal-union array → combobox popup ───
    @meta.label 'Frameworks'
    @meta.description 'Literal-union array — dispatches to the multiselect renderer (combobox popup with chips), not the add/remove array UI.'
    frameworksUsed: ('react' | 'vue' | 'svelte' | 'angular')[]

    // ── Multiselect: string[] with explicit @ui.form.options ─
    @meta.label 'Roles'
    @meta.description 'string[] with @ui.form.options — also dispatches to multiselect.'
    @ui.form.options 'Admin', 'admin'
    @ui.form.options 'Editor', 'editor'
    @ui.form.options 'Viewer', 'viewer'
    roles: string[]

    // ── Optional multiselect ────────────────────────────────
    @meta.label 'Preferred frameworks'
    @meta.description 'Optional literal-union array — renders the combobox popup with nothing pre-selected.'
    frameworks?: ('react' | 'vue')[]

    // ── Bounded multiselect (minLength/maxLength) ───────────
    @meta.label 'Topics'
    @meta.description 'string[] options with minLength 1 / maxLength 3 — submission surfaces array-level validation.'
    @ui.form.options 'Frontend', 'frontend'
    @ui.form.options 'Backend', 'backend'
    @ui.form.options 'DevOps', 'devops'
    @ui.form.options 'Design', 'design'
    @expect.minLength 1, 'Pick at least one topic'
    @expect.maxLength 3, 'Pick at most three topics'
    topics: string[]
}
