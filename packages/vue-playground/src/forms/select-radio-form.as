@meta.label 'Select & Radio Demo'
@ui.submit.text 'Submit'
export interface SelectRadioForm {
    // Select with static options
    @meta.label 'Country'
    @ui.placeholder 'Select a country'
    @ui.options 'United States', 'us'
    @ui.options 'Canada', 'ca'
    @ui.options 'United Kingdom', 'uk'
    @ui.options 'Germany', 'de'
    @ui.options 'Japan', 'jp'
    @ui.order 1
    country?: ui.select

    // Radio with static options
    @meta.label 'Gender'
    @ui.options 'Male', 'male'
    @ui.options 'Female', 'female'
    @ui.options 'Other', 'other'
    @ui.order 2
    gender?: ui.radio

    // Checkbox (single boolean)
    @meta.label 'I agree to terms and conditions'
    @ui.order 3
    agreeToTerms: ui.checkbox

    // Another select
    @meta.label 'Favorite Color'
    @ui.placeholder 'Pick a color'
    @ui.options 'Red', 'red'
    @ui.options 'Blue', 'blue'
    @ui.options 'Green', 'green'
    @ui.options 'Purple', 'purple'
    @ui.order 4
    favoriteColor?: ui.select

    // Radio with more options
    @meta.label 'Priority'
    @ui.options 'Low', 'low'
    @ui.options 'Medium', 'medium'
    @ui.options 'High', 'high'
    @ui.options 'Critical', 'critical'
    @ui.order 5
    priority?: ui.radio

    // Context-driven select
    @meta.label 'City'
    @ui.placeholder 'Select a city'
    @ui.fn.options '(v, data, context) => context.cityOptions || []'
    @ui.order 6
    city?: ui.select

    // Action button
    @meta.label 'Reset Selections'
    @ui.altAction 'reset'
    @ui.order 7
    resetAction: ui.action
}
