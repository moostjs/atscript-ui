@meta.label 'Company Settings'
@meta.description 'Each nested struct is a collapsible section. Click a header to fold it.'
@ui.form.submit.text 'Save changes'
export interface CompanySettings {
    @meta.label 'Company Name'
    @ui.form.placeholder 'Acme Corp'
    @meta.required 'Company name is required'
    companyName: string

    @meta.label 'Headquarters'
    @meta.description 'Primary business address. Used for contracts and tax documents.'
    headquarters: {
        @meta.label 'Street'
        @ui.form.placeholder '123 Main St'
        @meta.required 'Street is required'
        street: string

        @meta.label 'City'
        @ui.form.placeholder 'San Francisco'
        @meta.required 'City is required'
        city: string

        @meta.label 'ZIP Code'
        @ui.form.placeholder '94158'
        @meta.required 'ZIP code is required'
        zip: string

        @meta.label 'Country'
        @meta.description 'ISO country + dialing details for compliance.'
        country: {
            @meta.label 'Country Name'
            @ui.form.placeholder 'United States'
            @meta.required 'Country name is required'
            name: string

            @meta.label 'ISO Code'
            @ui.form.placeholder 'US'
            @ui.form.fn.hint '(v) => v && v.length !== 2 ? "Use a 2-letter ISO code" : ""'
            @meta.required 'ISO code is required'
            code: string

            @meta.label 'Dial Code'
            @ui.form.placeholder '+1'
            dialCode?: string

            @meta.label 'Timezone'
            @meta.description 'Default timezone for company-wide schedules.'
            timezone: {
                @meta.label 'IANA TZ'
                @ui.form.placeholder 'America/Los_Angeles'
                @meta.required 'Timezone is required'
                tz: string

                @meta.label 'DST handling'
                @meta.description 'Daylight saving time policy and rule overrides.'
                dst: {
                    @meta.label 'Auto-adjust'
                    @ui.type 'checkbox'
                    autoAdjust?: boolean

                    @meta.label 'Manual offset (minutes)'
                    @ui.type 'number'
                    manualOffset?: number

                    @meta.label 'Reminder rules'
                    @meta.description 'Notify admins ahead of DST switches.'
                    reminders: {
                        @meta.label 'Channel'
                        @ui.form.options 'Email', 'email'
                        @ui.form.options 'Slack', 'slack'
                        @meta.required 'Channel is required'
                        channel: ui.select

                        @meta.label 'Lead time (days)'
                        @ui.type 'number'
                        @expect.min 0, '0 or greater'
                        leadTimeDays?: number
                    }
                }
            }
        }
    }

    @meta.label 'Primary contact'
    @meta.description 'Who we reach out to for billing, legal and security matters.'
    contact: {
        @meta.label 'First Name'
        @ui.form.placeholder 'Jane'
        @meta.required 'First name is required'
        firstName: string

        @meta.label 'Last Name'
        @ui.form.placeholder 'Doe'
        lastName?: string

        @meta.label 'Email'
        @ui.form.placeholder 'jane@acme.com'
        @meta.required 'Email is required'
        email: string.email

        @meta.label 'Phone'
        @ui.form.placeholder '+1 555 0100'
        phone?: string
    }

    @meta.label 'Billing & invoicing'
    @meta.description 'Tax, currency and payment terms.'
    billing: {
        @meta.label 'VAT ID'
        @ui.form.placeholder 'EU123456789'
        vatId?: string

        @meta.label 'Currency'
        @ui.form.placeholder 'Select a currency'
        @ui.form.options 'USD — US Dollar', 'USD'
        @ui.form.options 'EUR — Euro', 'EUR'
        @ui.form.options 'GBP — Pound', 'GBP'
        @ui.form.options 'JPY — Yen', 'JPY'
        @meta.required 'Currency is required'
        currency: ui.select

        @meta.label 'Invoice Email'
        @ui.form.placeholder 'invoices@acme.com'
        invoiceEmail?: string.email

        @meta.label 'Payment Terms'
        @meta.description 'Default invoice due window and reminders.'
        paymentTerms: {
            @meta.label 'Due (days)'
            @ui.type 'number'
            @expect.min 0, 'Must be 0 or greater'
            @expect.max 180, 'Cannot exceed 180 days'
            dueDays: number

            @meta.label 'Late fee (%)'
            @ui.type 'number'
            @expect.min 0, 'Must be 0 or greater'
            lateFeePercent?: number

            @meta.label 'Send reminder emails'
            @ui.type 'checkbox'
            sendReminders?: boolean
        }
    }
}
