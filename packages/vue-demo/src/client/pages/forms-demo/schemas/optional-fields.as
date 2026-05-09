@meta.label 'Optional Fields Showcase'
@meta.description 'Every supported field type, all marked optional. Toggle each to verify the optional → enabled → clear flow. Constraints are wired so submitting an enabled-but-invalid field surfaces the error renderer.'
@ui.form.submit.text 'Save'
export interface OptionalFieldsForm {
    // ── Primitives ──────────────────────────────────────────
    @meta.label 'Text'
    @meta.description 'Free-form short text. Description should render muted below the label.'
    @ui.form.placeholder 'Hello'
    @meta.required 'Text is required'
    @ui.form.grid.colSpan '6'
    text?: string

    @meta.label 'Email'
    @meta.description 'We will use this for account notifications and password resets.'
    @ui.form.placeholder 'me@example.com'
    @meta.required 'Email is required'
    @ui.form.grid.colSpan '6'
    email?: string.email

    @meta.label 'Password'
    @meta.description 'At least 8 characters. Mix letters, numbers, and symbols for strength.'
    @ui.type 'password'
    @meta.required 'Password is required'
    @expect.minLength 8, 'At least 8 characters'
    @ui.form.grid.colSpan '6'
    password?: string

    @meta.label 'Age'
    @meta.description 'Used for age-gated features. We never display this publicly.'
    @ui.type 'number'
    @expect.min 18, 'Must be 18 or older'
    @expect.max 150, 'Must be 150 or less'
    @ui.form.grid.colSpan '6'
    age?: number

    @meta.label 'Bio'
    @meta.description 'A short blurb shown on your profile. Markdown is not supported.'
    @ui.type 'textarea'
    @ui.form.placeholder 'A few words about yourself…'
    @meta.required 'Bio is required'
    @expect.minLength 10, 'Tell us a bit more (min 10 chars)'
    bio?: string

    @meta.label 'I agree to the terms'
    @meta.description 'You can revoke consent any time from billing settings.'
    @ui.type 'checkbox'
    @meta.required 'You must agree to continue'
    agreed?: boolean

    // ── Select / Radio (with @ui.form.options) ──────────────
    @meta.label 'Country (select)'
    @meta.description 'Determines the default tax rate and currency for your invoices.'
    @ui.form.placeholder 'Pick a country'
    @ui.form.options 'United States', 'us'
    @ui.form.options 'Canada', 'ca'
    @ui.form.options 'Germany', 'de'
    @ui.form.options 'Japan', 'jp'
    @meta.required 'Country is required'
    @ui.form.grid.colSpan '6'
    country?: ui.select

    @meta.label 'Priority (radio)'
    @meta.description 'Higher priority items are reviewed first. Most teams pick Medium.'
    @ui.form.options 'Low', 'low'
    @ui.form.options 'Medium', 'medium'
    @ui.form.options 'High', 'high'
    @meta.required 'Priority is required'
    @ui.form.grid.colSpan '6'
    priority?: ui.radio

    // ── Object (inline nested struct) ───────────────────────
    @meta.label 'Address'
    @meta.description 'A nested struct, optional as a whole. Inner fields validate when enabled.'
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
    }

    // ── Array of primitives ─────────────────────────────────
    @meta.label 'Tags'
    @meta.description 'String array — minLength validates the array as a whole.'
    @expect.minLength 1, 'At least one tag is required'
    tags?: string[]

    // ── Array of objects ────────────────────────────────────
    @meta.label 'Phone numbers'
    @meta.description 'Object array — each row has its own required fields.'
    @expect.minLength 1, 'At least one phone number is required'
    phones?: {
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

    // ── Tuple ───────────────────────────────────────────────
    @meta.label 'Coordinates'
    @meta.description 'Fixed-shape tuple [latitude, longitude] — both must be present.'
    coords?: [number, number]
}
