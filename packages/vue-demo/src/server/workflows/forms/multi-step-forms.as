@wf.context.pass 'step'
@meta.label 'Step 1 of 3 — Your name'
@ui.form.submit.text 'Continue'
export interface MultiStepNameForm {
    @meta.label 'Name'
    @ui.form.placeholder 'Anything'
    @meta.required 'Name is required'
    @expect.minLength 1, 'At least 1 character'
    name: string
}

@wf.context.pass 'step'
@wf.context.pass 'name'
@meta.label 'Step 2 of 3 — Favourite colour'
@ui.form.submit.text 'Continue'
@ui.form.fn.title '(data, ctx) => `Nice to meet you, ${ctx.name}! Pick a colour.`'
export interface MultiStepColorForm {
    @meta.label 'Colour'
    @meta.required 'Pick one'
    @ui.form.options 'Red', 'red'
    @ui.form.options 'Green', 'green'
    @ui.form.options 'Blue', 'blue'
    color: ui.radio
}

@wf.context.pass 'step'
@wf.context.pass 'name'
@wf.context.pass 'color'
@meta.label 'Step 3 of 3 — Confirm'
@ui.form.submit.text 'Confirm'
@ui.form.fn.title '(data, ctx) => `Confirm: ${ctx.name} likes ${ctx.color}.`'
export interface MultiStepConfirmForm {
    @meta.label 'I confirm the details above'
    @meta.required 'Tick to confirm'
    confirm: ui.checkbox
}
