@meta.label 'Studio Address'
interface Address {
    @meta.label 'Street'
    street: string

    @meta.label 'City'
    city: string

    @meta.label 'ZIP'
    zip: string

    @meta.label 'Country'
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
@meta.description 'Each field below uses a different customization mechanism. The custom widgets are wired in Step 4 — Step 1 renders defaults so you can see the baseline.'
@ui.form.submit.text 'Save Profile'
export interface BuilderProfile {
    @meta.label 'Display Name'
    displayName: string

    @meta.label 'Bio'
    @ui.form.type 'bio'
    bio: string

    @meta.label 'Service Rating'
    @ui.form.type 'stars'
    rating: number

    @meta.label 'Quantity Available'
    @ui.form.component 'stepper'
    quantity: number

    @meta.label 'Brand Color'
    @ui.form.type 'color-swatch'
    brandColor: string

    @meta.label 'Tags'
    @ui.form.type 'tag-input'
    tags: string[]

    @meta.label 'Studio Address'
    @ui.form.type 'address-card'
    address: Address

    @meta.label 'Logo Accent (RGB)'
    @ui.form.type 'rgb-picker'
    logoRgb: [number, number, number]

    @meta.label 'Preferred Contact'
    @ui.form.type 'contact-card'
    contact: EmailContact | PhoneContact | InPersonContact
}
