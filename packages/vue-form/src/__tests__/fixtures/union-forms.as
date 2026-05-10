@meta.label 'Email contact'
type EmailContact = {
    @meta.label 'Email'
    @meta.required 'Email is required'
    email: string
    newsletter?: boolean
}

@meta.label 'Phone contact'
type PhoneContact = {
    @meta.label 'Phone'
    @meta.required 'Phone is required'
    phone: string
}

@meta.label 'Postal contact'
type PostalContact = {
    @meta.label 'Street'
    @meta.required 'Street is required'
    street: string
}

// Required object union — multiple variants.
export interface RequiredObjectUnionForm {
    @meta.label 'Primary contact'
    @meta.description 'Required object union of three variants.'
    primaryContact: EmailContact | PhoneContact | PostalContact
}

// Optional object union — variant menu in empty placeholder.
export interface OptionalObjectUnionForm {
    @meta.label 'Backup contact'
    backupContact?: EmailContact | PhoneContact
}

// Heterogeneous primitive union — variant picker switches input type.
export interface PrimitiveUnionForm {
    @meta.label 'Quantity or label'
    qty: string | number
}

// Discriminated literal-kind union — each variant has its own hidden discriminator.
@meta.label 'Login event'
type LoginEvent = {
    @meta.label 'type'
    @ui.form.hidden
    type: 'login'

    @meta.label 'User'
    @meta.required 'User is required'
    user: string
}

@meta.label 'Logout event'
type LogoutEvent = {
    @meta.label 'type'
    @ui.form.hidden
    type: 'logout'

    @meta.label 'User'
    @meta.required 'User is required'
    user: string
}

// Array of unions — each row picks its own variant.
export interface UnionArrayForm {
    @meta.label 'Audit log'
    @ui.form.label.singular 'entry'
    log: (LoginEvent | LogoutEvent)[]
}
