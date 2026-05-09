@meta.label 'Grid Layout Showcase'
@meta.description 'Mixed col/row spans, aliases, two-arg responsive, and a nested grid that re-stacks below 480px container width.'
@ui.form.submit.text 'Save'
export interface GridLayoutForm {
    @meta.label 'Title'
    @meta.description 'Default behaviour — no grid annotation, takes full row.'
    @ui.form.placeholder 'A short headline'
    @meta.required 'Title is required'
    title: string

    @meta.label 'First name'
    @ui.form.placeholder 'Jane'
    @meta.required 'First name is required'
    @ui.form.grid.colSpan '6'
    firstName: string

    @meta.label 'Last name'
    @ui.form.placeholder 'Doe'
    @meta.required 'Last name is required'
    @ui.form.grid.colSpan '6'
    lastName: string

    @meta.label 'City'
    @ui.form.placeholder 'San Francisco'
    @meta.required 'City is required'
    @ui.form.grid.colSpan '4'
    city: string

    @meta.label 'State'
    @ui.form.placeholder 'CA'
    @meta.required 'State is required'
    @ui.form.grid.colSpan '4'
    state: string

    @meta.label 'ZIP'
    @ui.form.placeholder '94158'
    @meta.required 'ZIP is required'
    @ui.form.grid.colSpan '4'
    zip: string

    @meta.label 'Email (alias half)'
    @meta.description 'Uses the colSpan="half" alias (= 6).'
    @ui.form.placeholder 'me@example.com'
    @meta.required 'Email is required'
    @ui.form.grid.colSpan 'half'
    email: string.email

    @meta.label 'Country (alias third)'
    @meta.description 'Uses the colSpan="third" alias (= 4) — pairs naturally with two more thirds, but here demonstrates the alias on its own row.'
    @ui.form.placeholder 'United States'
    @meta.required 'Country is required'
    @ui.form.grid.colSpan 'third'
    country: string

    @meta.label 'Phone (responsive default)'
    @meta.description 'Two-arg "6", "12" — narrow defaults to full anyway, kept here to confirm explicit narrow="12" still works.'
    @ui.form.placeholder '+1 555 0100'
    @meta.required 'Phone is required'
    @ui.form.grid.colSpan '6', '12'
    phone: string

    @meta.label 'Mobile (single-arg)'
    @ui.form.placeholder '+1 555 0199'
    @meta.required 'Mobile is required'
    @ui.form.grid.colSpan '6'
    mobile: string

    @meta.label 'Bio'
    @meta.description 'rowSpan=2 — tall textarea spans two rows; the two short fields on its right (Nickname, Website) stack into those slots instead of wrapping below.'
    @ui.type 'textarea'
    @ui.form.placeholder 'A short bio…'
    @meta.required 'Bio is required'
    @expect.minLength 10, 'At least 10 characters'
    @ui.form.grid.colSpan '6'
    @ui.form.grid.rowSpan '2'
    bio: string

    @meta.label 'Nickname'
    @ui.form.placeholder 'janedoe'
    @meta.required 'Nickname is required'
    @ui.form.grid.colSpan '6'
    nickname: string

    @meta.label 'Website'
    @ui.form.placeholder 'https://example.com'
    @meta.required 'Website is required'
    @ui.form.grid.colSpan '6'
    website: string

    @meta.label 'Discount %'
    @meta.description 'Quarter-width on desktop, half on narrow — explicit narrow override.'
    @ui.type 'number'
    @expect.min 0, 'Must be ≥ 0'
    @expect.max 100, 'Must be ≤ 100'
    @ui.form.grid.colSpan '4', '6'
    discount: number

    @meta.label 'Address'
    @meta.description 'Optional struct at half-width — its inner grid auto-stacks because the inner container is below 480px.'
    @ui.form.grid.colSpan '6'
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
        @meta.required 'ZIP is required'
        @ui.form.grid.colSpan '6'
        zip: string
    }

    @meta.label 'Phone numbers'
    @meta.description 'Array of objects — each item is full-width inside the array grid, but its own fields use the item-level grid.'
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
}
