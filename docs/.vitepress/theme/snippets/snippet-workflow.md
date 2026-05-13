<div class="file-sep">login.workflow.ts</div>

```typescript
@Controller()
export class LoginFlow {
  @Workflow('auth/login')
  @WorkflowSchema([{ id: 'creds' }, { id: 'mfa' }])
  flow() {}

  @Step('creds')
  async creds(@FormInput input?: LoginForm) {
    if (!input) return requireInput(LoginForm)
    return { user: await authenticate(input) }
  }

  @Step('mfa')
  async mfa(@FormInput input?: MfaForm, @WfState user) {
    if (user.mfaEnabled && !input) return requireInput(MfaForm)
    return { finished: true, redirect: '/dashboard' }
  }
}
```

<div class="file-sep">App.vue</div>

```vue
<AsWfForm path="/api/wf" name="auth/login" @finished="goHome" />
```
