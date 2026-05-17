export interface LiteralUnionMultiselect {
    tags: ('a' | 'b' | 'c')[]
}

export interface ExplicitOptionsMultiselect {
    @ui.form.options 'admin'
    @ui.form.options 'user'
    @ui.form.options 'guest'
    roles: string[]
}

export interface PlainStringArray {
    items: string[]
}

export interface DisabledMultiselect {
    @ui.form.disabled
    tags: ('a' | 'b' | 'c')[]
}

export interface ReadonlyMultiselect {
    @meta.readonly
    tags: ('a' | 'b' | 'c')[]
}

export interface BoundedMultiselect {
    @expect.minLength 1, 'At least one tag required'
    @expect.maxLength 2, 'At most two tags'
    tags: ('a' | 'b' | 'c')[]
}

export interface OptionalMultiselect {
    @meta.label 'Preferred frameworks'
    tags?: ('a' | 'b')[]

    @meta.label 'Roles'
    @ui.form.options 'Admin', 'admin'
    @ui.form.options 'Editor', 'editor'
    roles?: string[]
}
