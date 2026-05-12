@meta.label 'Studio Address'
interface Address {
    @meta.label 'Street'
    @ui.form.grid.colSpan '12'
    street: string

    @meta.label 'City'
    @ui.form.grid.colSpan '12'
    city: string

    @meta.label 'ZIP'
    @ui.form.grid.colSpan '12'
    zip: string

    @meta.label 'Country'
    @ui.form.grid.colSpan '12'
    country: string
}

@meta.label 'Email'
interface EmailContact {
    @meta.label 'Email Address'
    email: string
}

@meta.label 'Phone'
interface PhoneContact {
    @meta.label 'Phone'
    phone: string
}

@meta.label 'In Person'
interface InPersonContact {
    @meta.label 'Address'
    address: string
}

@meta.label 'Builder Profile'
@meta.description 'Each field demonstrates one of two customization mechanisms: `@ui.form.type` (data-type variant — here `bio` as long-text) dispatches through the types map, and `@ui.form.component` (widget override) routes through the components map. The `Display Name` field has no annotation and uses the default.'
@ui.form.submit.text 'Save Profile'
export interface BuilderProfile {
    @meta.label 'Display Name'
    @ui.form.grid.colSpan '12'
    displayName: string

    @meta.label 'Bio'
    @ui.form.type 'bio'
    @ui.form.grid.colSpan '12'
    bio: string

    @meta.label 'Service Rating'
    @ui.form.component 'stars'
    @ui.form.grid.colSpan '6'
    rating: number

    @meta.label 'Quantity Available'
    @ui.form.component 'stepper'
    @ui.form.grid.colSpan '6'
    quantity: number

    @meta.label 'Brand Color'
    @ui.form.component 'color-swatch'
    @ui.form.grid.colSpan '12'
    brandColor: string

    @meta.label 'Tags'
    @ui.form.component 'tag-input'
    @ui.form.grid.colSpan '12'
    tags: string[]

    @meta.label 'Studio Address'
    @ui.form.component 'address-card'
    @ui.form.grid.colSpan '12'
    address: Address

    @meta.label 'Logo Accent (RGB)'
    @ui.form.component 'rgb-picker'
    @ui.form.grid.colSpan '12'
    logoRgb: [number, number, number]

    @meta.label 'Preferred Contact'
    @ui.form.component 'contact-card'
    @ui.form.grid.colSpan '12'
    contact: EmailContact | PhoneContact | InPersonContact
}
