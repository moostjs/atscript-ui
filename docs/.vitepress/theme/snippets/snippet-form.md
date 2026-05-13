```atscript
@meta.label 'Contact'
@ui.submit.text 'Send'
export interface ContactForm {
  @meta.label 'Name'
  @ui.placeholder 'Jane Doe'
  @meta.required
  name: string

  @meta.label 'Email'
  @ui.placeholder 'jane@example.com'
  email: string.email

  @meta.label 'Message'
  @ui.type 'textarea'
  message: string
}
```
