@meta.label 'Select & Radio Demo'
@ui.form.submit.text 'Submit'
export interface SelectRadioForm {
    // Select with static options
    @meta.label 'Country'
    @ui.form.placeholder 'Select a country'
    @ui.form.options 'United States', 'us'
    @ui.form.options 'Canada', 'ca'
    @ui.form.options 'United Kingdom', 'uk'
    @ui.form.options 'Germany', 'de'
    @ui.form.options 'Japan', 'jp'
    @ui.form.order 1
    country?: ui.select

    // Radio with static options
    @meta.label 'Gender'
    @ui.form.options 'Male', 'male'
    @ui.form.options 'Female', 'female'
    @ui.form.options 'Other', 'other'
    @ui.form.order 2
    gender?: ui.radio

    // Checkbox (single boolean)
    @meta.label 'I agree to terms and conditions'
    @ui.form.order 3
    agreeToTerms: ui.checkbox

    // Another select
    @meta.label 'Favorite Color'
    @ui.form.placeholder 'Pick a color'
    @ui.form.options 'Red', 'red'
    @ui.form.options 'Blue', 'blue'
    @ui.form.options 'Green', 'green'
    @ui.form.options 'Purple', 'purple'
    @ui.form.order 4
    favoriteColor?: ui.select

    // Radio with more options
    @meta.label 'Priority'
    @ui.form.options 'Low', 'low'
    @ui.form.options 'Medium', 'medium'
    @ui.form.options 'High', 'high'
    @ui.form.options 'Critical', 'critical'
    @ui.form.order 5
    priority?: ui.radio

    // Context-driven select
    @meta.label 'City'
    @ui.form.placeholder 'Select a city'
    @ui.form.fn.options '(v, data, context) => context.cityOptions || []'
    @ui.form.order 6
    city?: ui.select

    // Action button
    @meta.label 'Reset Selections'
    @ui.form.action 'reset'
    @ui.form.order 7
    resetAction: ui.action
}
