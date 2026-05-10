// ── Object variants distinguished by required-prop fingerprint ──
// `Person` and `Company` share no required props, so a prefilled value
// lands on the right variant via the validator scan in `detectUnionVariant`.

@meta.label 'Person'
type Person = {
    @meta.label 'First name'
    @ui.form.placeholder 'Ada'
    @meta.required 'First name is required'
    @ui.form.grid.colSpan '6'
    firstName: string

    @meta.label 'Last name'
    @ui.form.placeholder 'Lovelace'
    @meta.required 'Last name is required'
    @ui.form.grid.colSpan '6'
    lastName: string

    @meta.label 'Email'
    @ui.form.placeholder 'ada@example.com'
    email?: string
}

@meta.label 'Company'
type Company = {
    @meta.label 'Company name'
    @ui.form.placeholder 'ACME, Inc.'
    @meta.required 'Company name is required'
    @ui.form.grid.colSpan '8'
    companyName: string

    @meta.label 'Tax ID'
    @ui.form.placeholder 'EIN / VAT'
    @meta.required 'Tax ID is required'
    @ui.form.grid.colSpan '4'
    taxId: string

    @meta.label 'Billing email'
    billingEmail?: string
}

// ── Object variants without a discriminator, distinguished by which
// required prop is present. No literal field — the validator scan picks
// the variant whose required props match the value's keys. ──

@meta.label 'Email channel'
type EmailNotification = {
    @meta.label 'Address'
    @ui.form.placeholder 'alerts@example.com'
    @meta.required 'Email is required'
    email: string

    @meta.label 'HTML format'
    html?: boolean
}

@meta.label 'SMS channel'
type SmsNotification = {
    @meta.label 'Phone'
    @ui.form.placeholder '+1 555 0100'
    @meta.required 'Phone is required'
    phone: string
}

@meta.label 'Push channel'
type PushNotification = {
    @meta.label 'Device token'
    @ui.form.placeholder 'fcm:…'
    @meta.required 'Device token is required'
    deviceToken: string
}

// ── Discriminated variants — every member carries a literal `kind` prop,
// so `detectDiscriminator` exposes O(1) variant matching by `kind` value.
// `kind` is hidden from the form because the user doesn't pick it: the
// variant picker writes it implicitly when the user switches type. ──

@meta.label 'URL image'
type UrlImage = {
    @meta.label 'kind'
    @ui.form.hidden
    kind: 'url'

    @meta.label 'URL'
    @ui.form.placeholder 'https://…'
    @meta.required 'URL is required'
    url: string

    @meta.label 'Alt text'
    alt?: string
}

@meta.label 'Uploaded image'
type UploadImage = {
    @meta.label 'kind'
    @ui.form.hidden
    kind: 'upload'

    @meta.label 'File ID'
    @meta.required 'File ID is required'
    fileId: string

    @meta.label 'Original filename'
    filename?: string
}

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

@meta.label 'Note event'
type NoteEvent = {
    @meta.label 'type'
    @ui.form.hidden
    type: 'note'

    @meta.label 'Text'
    @meta.required 'Note text is required'
    text: string
}

// ── 3-level depth: discriminated union → object → discriminated union.
// Exercises the L1 section / L2 island / L3 section alternation through
// union-dispatch boundaries, and the discriminator fast-path at every depth.

@meta.label 'Bearer token'
type BearerAuth = {
    @meta.label 'kind'
    @ui.form.hidden
    kind: 'bearer'

    @meta.label 'Token'
    @ui.form.placeholder 'eyJhbGciOi…'
    @meta.required 'Token is required'
    token: string
}

@meta.label 'Basic auth'
type BasicAuth = {
    @meta.label 'kind'
    @ui.form.hidden
    kind: 'basic'

    @meta.label 'Username'
    @meta.required 'Username is required'
    @ui.form.grid.colSpan '6'
    username: string

    @meta.label 'Password'
    @meta.required 'Password is required'
    @ui.form.grid.colSpan '6'
    password: string
}

@meta.label 'Endpoint'
type Endpoint = {
    @meta.label 'URL'
    @ui.form.placeholder 'https://api.example.com/hook'
    @meta.required 'URL is required'
    url: string

    @meta.label 'Auth'
    @meta.description 'Optional discriminated union nested two levels deep.'
    auth?: BearerAuth | BasicAuth
}

@meta.label 'Email subscriber'
type EmailSubscriber = {
    @meta.label 'kind'
    @ui.form.hidden
    kind: 'email'

    @meta.label 'Address'
    @ui.form.placeholder 'team@example.com'
    @meta.required 'Email is required'
    address: string
}

@meta.label 'Webhook subscriber'
type WebhookSubscriber = {
    @meta.label 'kind'
    @ui.form.hidden
    kind: 'webhook'

    @meta.label 'Endpoint'
    endpoint: Endpoint
}

@meta.label 'Unions Showcase'
@meta.description 'Each field demonstrates a different union-matching scenario, from pure literals to discriminated objects.'
@ui.form.submit.text 'Save'
export interface UnionsShowcaseForm {
    // 1. Pure literal union — renders as a built-in <select>, no variant picker.
    @meta.label 'Account tier'
    @meta.description 'Pure literal union (string literals only). The form dispatches it to a <select> directly — no variant picker needed.'
    tier: 'free' | 'pro' | 'enterprise'

    // 2. Heterogeneous primitives — variant picker switches the input type.
    @meta.label 'Quantity or label'
    @meta.description 'Heterogeneous primitive union. Picker toggles between numeric and text input; the validator distinguishes which variant matches the current value.'
    qty: string | number

    // 3. Object variants of different shapes — required-prop fingerprint
    //    distinguishes Person from Company.
    @meta.label 'Customer'
    @meta.description 'Two structurally distinct object variants. `firstName`+`lastName` flag a Person; `companyName`+`taxId` flag a Company. No discriminator field needed.'
    customer: Person | Company

    // 4. Optional object union with three variants distinguished by required
    //    props (no shared literal field).
    @meta.label 'Notification channel'
    @meta.description 'Optional object union. Three variants — Email, SMS, Push — each identified by which required field is present (`email` / `phone` / `deviceToken`).'
    notification?: EmailNotification | SmsNotification | PushNotification

    // 5. Discriminated union with a hidden literal `kind` field.
    @meta.label 'Profile image'
    @meta.description 'Discriminated union. Every variant carries a literal `kind` prop (`"url"` / `"upload"`) used by `detectDiscriminator` for O(1) variant matching. The discriminator is hidden from the form — the picker sets it implicitly.'
    image?: UrlImage | UploadImage

    // 6. Array of a discriminated union — each row picks a variant via the
    //    array's Add menu.
    @meta.label 'Audit log'
    @meta.description 'Array of a discriminated union (`type: "login" | "logout" | "note"`). Each row picks a variant when added; matching on save uses the discriminator hash.'
    @ui.form.label.singular 'entry'
    log: (LoginEvent | LogoutEvent | NoteEvent)[]

    // 7. Three-level depth — verifies the collapsible alternation
    //    (L1 section → L2 island → L3 section) works across union boundaries.
    @meta.label 'Subscriber'
    @meta.description 'Three-level depth: subscriber variant (L1) → endpoint object (L2) → auth variant (L3). Picking Webhook reveals the nested Endpoint card, which itself contains an optional Auth union.'
    subscriber: EmailSubscriber | WebhookSubscriber
}
