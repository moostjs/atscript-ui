// Fixture for the custom container-renderer primitives
// (useAsFieldScope / useAsOptionalField / useAsVisibleFields / useAsLevel).
//
// Exercises every shape a container renderer must partition or decorate:
//   • scalar leaves (title, showAdvanced)
//   • a statically-hidden structured child (@ui.form.hidden)
//   • a structured child hidden via @ui.form.fn.hidden, toggled by a data flag
//   • an optional structured child (enable/clear round-trip)
//   • a leaf carrying a static + fn metadata pair (resolveProp)
//   • a leaf carrying only the static half of that pair
//   • an array child
//   • a nested structured object (level alternation)

@meta.label 'Secret Section'
type SecretSection = {
    @meta.label 'Code'
    code: string
}

@meta.label 'Advanced Section'
type AdvancedSection = {
    @meta.label 'Detail'
    detail: string
}

@meta.label 'Optional Section'
type OptionalSection = {
    @meta.label 'Note'
    note: string
}

@meta.label 'Address'
type Address = {
    @meta.label 'Street'
    street: string
}

@meta.label 'Profile'
type Profile = {
    @meta.label 'Bio'
    bio: string

    address: Address
}

export interface ContainerForm {
    @meta.label 'Title'
    title: string

    @ui.form.hidden
    secret: SecretSection

    @ui.form.fn.hidden '(v, data) => data.showAdvanced !== true'
    advanced: AdvancedSection

    optionalSection?: OptionalSection

    @meta.label 'Hinted'
    @ui.form.hint 'static hint'
    @ui.form.fn.hint '(v) => "v=" + String(v)'
    hinted: string

    @meta.label 'Static Hinted'
    @ui.form.hint 'only static'
    staticHinted: string

    @meta.label 'Profile'
    profile: Profile

    @meta.label 'Items'
    items: string[]

    @meta.label 'Show advanced'
    showAdvanced: boolean
}
