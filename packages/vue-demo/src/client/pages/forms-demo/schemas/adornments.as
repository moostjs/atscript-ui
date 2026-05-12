@meta.label 'Adornments Matrix'
@meta.description 'Every input type × every prefix/suffix × icon/text adornment combination. Use this page to scan the visual chrome for any combination at a glance.'
@ui.form.submit.text 'Save'
export interface AdornmentsMatrix {
    // ── Strings ────────────────────────────────────────────────
    @meta.label 'Strings'
    @meta.description 'Eight prefix/suffix permutations on `string` inputs.'
    strings: {
        @meta.label 'Plain'
        @meta.required 'Required'
        @ui.form.grid.colSpan '6'
        plain: string

        @meta.label 'Prefix icon'
        @meta.required 'Required'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.grid.colSpan '6'
        prefixIcon: string

        @meta.label 'Prefix text'
        @meta.required 'Required'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixText: string

        @meta.label 'Prefix both'
        @meta.required 'Required'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixBoth: string

        @meta.label 'Suffix icon'
        @meta.required 'Required'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.grid.colSpan '6'
        suffixIcon: string

        @meta.label 'Suffix text'
        @meta.required 'Required'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixText: string

        @meta.label 'Suffix both'
        @meta.required 'Required'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixBoth: string

        @meta.label 'Full house'
        @meta.required 'Required'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        fullHouse: string
    }

    // ── Numbers ────────────────────────────────────────────────
    // (number / decimal are required by virtue of being non-optional;
    //  @meta.required is restricted to string | boolean fields.)
    @meta.label 'Numbers'
    @meta.description 'Eight prefix/suffix permutations on `number` inputs.'
    numbers: {
        @meta.label 'Plain'
        @ui.form.grid.colSpan '6'
        plain: number

        @meta.label 'Prefix icon'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.grid.colSpan '6'
        prefixIcon: number

        @meta.label 'Prefix text'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixText: number

        @meta.label 'Prefix both'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixBoth: number

        @meta.label 'Suffix icon'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.grid.colSpan '6'
        suffixIcon: number

        @meta.label 'Suffix text'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixText: number

        @meta.label 'Suffix both'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixBoth: number

        @meta.label 'Full house'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        fullHouse: number
    }

    // ── Decimals ───────────────────────────────────────────────
    @meta.label 'Decimals'
    @meta.description 'Eight prefix/suffix permutations on `decimal` inputs (default scale 2).'
    decimals: {
        @meta.label 'Plain'
        @ui.form.grid.colSpan '6'
        plain: decimal

        @meta.label 'Prefix icon'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.grid.colSpan '6'
        prefixIcon: decimal

        @meta.label 'Prefix text'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixText: decimal

        @meta.label 'Prefix both'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixBoth: decimal

        @meta.label 'Suffix icon'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.grid.colSpan '6'
        suffixIcon: decimal

        @meta.label 'Suffix text'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixText: decimal

        @meta.label 'Suffix both'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixBoth: decimal

        @meta.label 'Full house'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        fullHouse: decimal
    }

    // ── Dates ──────────────────────────────────────────────────
    @meta.label 'Dates'
    @meta.description 'Eight prefix/suffix permutations on `date` inputs (string storage).'
    dates: {
        @meta.label 'Plain'
        @meta.required 'Required'
        @ui.type 'date'
        @ui.form.grid.colSpan '6'
        plain: string

        @meta.label 'Prefix icon'
        @meta.required 'Required'
        @ui.type 'date'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.grid.colSpan '6'
        prefixIcon: string

        @meta.label 'Prefix text'
        @meta.required 'Required'
        @ui.type 'date'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixText: string

        @meta.label 'Prefix both'
        @meta.required 'Required'
        @ui.type 'date'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixBoth: string

        @meta.label 'Suffix icon'
        @meta.required 'Required'
        @ui.type 'date'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.grid.colSpan '6'
        suffixIcon: string

        @meta.label 'Suffix text'
        @meta.required 'Required'
        @ui.type 'date'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixText: string

        @meta.label 'Suffix both'
        @meta.required 'Required'
        @ui.type 'date'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixBoth: string

        @meta.label 'Full house'
        @meta.required 'Required'
        @ui.type 'date'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        fullHouse: string
    }

    // ── Datetimes ──────────────────────────────────────────────
    @meta.label 'Datetimes'
    @meta.description 'Eight prefix/suffix permutations on `datetime` inputs (string storage).'
    datetimes: {
        @meta.label 'Plain'
        @meta.required 'Required'
        @ui.type 'datetime'
        @ui.form.grid.colSpan '6'
        plain: string

        @meta.label 'Prefix icon'
        @meta.required 'Required'
        @ui.type 'datetime'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.grid.colSpan '6'
        prefixIcon: string

        @meta.label 'Prefix text'
        @meta.required 'Required'
        @ui.type 'datetime'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixText: string

        @meta.label 'Prefix both'
        @meta.required 'Required'
        @ui.type 'datetime'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixBoth: string

        @meta.label 'Suffix icon'
        @meta.required 'Required'
        @ui.type 'datetime'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.grid.colSpan '6'
        suffixIcon: string

        @meta.label 'Suffix text'
        @meta.required 'Required'
        @ui.type 'datetime'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixText: string

        @meta.label 'Suffix both'
        @meta.required 'Required'
        @ui.type 'datetime'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixBoth: string

        @meta.label 'Full house'
        @meta.required 'Required'
        @ui.type 'datetime'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        fullHouse: string
    }

    // ── Times ──────────────────────────────────────────────────
    @meta.label 'Times'
    @meta.description 'Eight prefix/suffix permutations on `time` inputs (string storage).'
    times: {
        @meta.label 'Plain'
        @meta.required 'Required'
        @ui.type 'time'
        @ui.form.grid.colSpan '6'
        plain: string

        @meta.label 'Prefix icon'
        @meta.required 'Required'
        @ui.type 'time'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.grid.colSpan '6'
        prefixIcon: string

        @meta.label 'Prefix text'
        @meta.required 'Required'
        @ui.type 'time'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixText: string

        @meta.label 'Prefix both'
        @meta.required 'Required'
        @ui.type 'time'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.grid.colSpan '6'
        prefixBoth: string

        @meta.label 'Suffix icon'
        @meta.required 'Required'
        @ui.type 'time'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.grid.colSpan '6'
        suffixIcon: string

        @meta.label 'Suffix text'
        @meta.required 'Required'
        @ui.type 'time'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixText: string

        @meta.label 'Suffix both'
        @meta.required 'Required'
        @ui.type 'time'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        suffixBoth: string

        @meta.label 'Full house'
        @meta.required 'Required'
        @ui.type 'time'
        @ui.form.prefix.icon 'i-as-search'
        @ui.form.prefix '$'
        @ui.form.suffix.icon 'i-as-check'
        @ui.form.suffix 'USD'
        @ui.form.grid.colSpan '6'
        fullHouse: string
    }
}
