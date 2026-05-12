@meta.label 'Event Registration'
@meta.description 'Every field uses a different @ui.form.fn.* annotation. Type into any field — watch the dependent fields and chrome react.'

@ui.form.fn.title '(data) => data.firstName ? "Registration for " + data.firstName : "Event Registration"'
@ui.form.fn.submit.text '(data) => data.hasPlusOne ? "Register 2 attendees" : "Register"'
@ui.form.fn.submit.disabled '(data) => !data.firstName || !data.email'
export interface EventRegistration {
    @meta.label 'First Name'
    @ui.form.grid.colSpan '6'
    firstName: string

    @meta.label 'Email'
    @ui.form.grid.colSpan '6'
    @ui.form.fn.placeholder '(v, data) => data.firstName ? "Email for " + data.firstName : "you@example.com"'
    @ui.form.fn.description '(v, data) => data.firstName ? "Confirmation will be sent to this address for " + data.firstName : "We will send your registration confirmation here"'
    email: string

    @meta.label 'Bringing a plus-one?'
    @ui.form.grid.colSpan '12'
    hasPlusOne: boolean

    @meta.label "Plus-one's name"
    @ui.form.grid.colSpan '12'
    @ui.form.fn.hidden '(v, data) => !data.hasPlusOne'
    plusOneName: string

    @meta.label 'T-shirt size'
    @ui.form.grid.colSpan '6'
    @ui.form.fn.options '(v, data) => data.hasPlusOne ? [{ key: "S", label: "Small" }, { key: "M", label: "Medium" }, { key: "L", label: "Large" }, { key: "XL", label: "X-Large" }, { key: "XS-PLUS", label: "Plus-One Small" }, { key: "M-PLUS", label: "Plus-One Medium" }] : [{ key: "S", label: "Small" }, { key: "M", label: "Medium" }, { key: "L", label: "Large" }, { key: "XL", label: "X-Large" }]'
    shirtSize: ui.select

    @meta.label 'Dietary preferences'
    @ui.form.grid.colSpan '6'
    @ui.form.fn.readonly '(v, data) => !data.email'
    @ui.form.fn.hint '(v, data) => !data.email ? "Enter your email first to enable this" : "Comma-separated list, e.g. vegan, no nuts"'
    dietary: string

    @meta.label 'Notes'
    @ui.form.grid.colSpan '12'
    @ui.form.fn.label '(v, data) => "Notes" + (v && v.length > 200 ? " (long)" : "")'
    @ui.form.fn.hint '(v, data) => (v ? v.length : 0) + " / 500 chars"'
    @ui.form.fn.classes '(v, data) => (v && v.length > 400) ? "as-notes-warn" : ""'
    @ui.form.fn.styles '(v, data) => v && v.length > 400 ? { "border-color": "orange" } : {}'
    @ui.form.validate '(v, data) => !v || v.length <= 500 || "Notes must be 500 chars or fewer"'
    notes: string

    @meta.label 'Confirm attendance'
    @ui.form.grid.colSpan '6'
    @ui.form.fn.disabled '(v, data) => !data.email || !data.firstName'
    @ui.form.fn.label '(v, data) => (!data.email || !data.firstName) ? "Confirm attendance — fill name + email first" : "Confirm attendance"'
    confirmAttendance: boolean

    @meta.label 'Total attendees'
    @ui.form.grid.colSpan '6'
    @ui.form.fn.value '(v, data) => data.hasPlusOne ? 2 : 1'
    attendees: ui.paragraph
}
