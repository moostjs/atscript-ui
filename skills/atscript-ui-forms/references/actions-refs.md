# actions-refs

Form actions (`@ui.form.action` + `AsAction`), multi-action forms, submit-button controls, and FK value-help pickers via `@db.rel.FK` + `AsRef`.

## Contents

- [Form actions — @ui.form.action](#form-actions--uiformaction)
- [AsAction default component](#asaction-default-component)
- [Multi-action forms](#multi-action-forms)
- [Below-submit placement + alt-action text/align](#below-submit-placement--alt-action-textalign)
- [Inline action on an input field](#inline-action-on-an-input-field)
- [Submit button controls](#submit-button-controls)
- [FK references — @db.rel.FK](#fk-references--dbrelfk)
- [ValueHelpClient flow](#valuehelpclient-flow)
- [@ui.dict.\* on the target type](#uidict-on-the-target-type)
- [clientFactory prop](#clientfactory-prop)
- [Recipes](#recipes)

## Form actions — @ui.form.action

A phantom field that renders as a button. Clicking it dispatches `action` on `<AsForm>` with `(name: string, data: TFormData)`.

```atscript
@meta.label 'Order'
export interface Order {
    id: number
    status: string

    @ui.form.action 'cancel', 'Cancel order'
    cancel: ui.action
}
```

```vue
<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { Order } from "./order.as";

const { def, formData } = createAsFormDef(Order);
const types = createDefaultTypes();

function handleAction(name: string, data: Order) {
  if (name === "cancel") doCancel(data.id);
}
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" @action="handleAction" />
</template>
```

Annotation arity: `@ui.form.action 'id'` or `@ui.form.action 'id', 'label'`. The `id` is the dispatch name; `label` is the button text. If `label` is omitted, AsField falls back to `@meta.label`, then the field name.

Phantom fields:

- Carry no data — they never appear in form submissions.
- Have `required === undefined` (the `*` marker never renders).
- Can also display computed text via `@ui.form.fn.value` if needed.

## AsAction default component

Default button renderer registered for the built-in `action` type, used to render `@ui.form.action` phantom fields.

```vue
<!-- Default AsAction component -->
<script setup lang="ts">
import type { TAsComponentProps } from "../types";
defineProps<TAsComponentProps>();
const emit = defineEmits<{ (e: "action", name: string): void }>();
</script>

<template>
  <!-- optional `text` prefix, then the link button; `align` → as-action-{left,center,right} -->
  <div
    class="as-action-field"
    :class="[$props.class, `as-action-${align ?? 'left'}`]"
    v-show="!hidden"
  >
    <span v-if="text" class="as-action-text">{{ text }}</span>
    <button
      type="button"
      class="as-field-action-link"
      @click="formAction && emit('action', formAction.id)"
    >
      {{ formAction?.label }}
    </button>
  </div>
</template>
```

`text` / `align` arrive as props from `@ui.form.attr` (see [Below-submit placement + alt-action text/align](#below-submit-placement--alt-action-textalign)). The link class (`as-field-action-link`) is on the `<button>` so its hover/focus underline binds to the link alone, not the row.

Swap globally:

```typescript
const types = { ...createDefaultTypes(), action: MyActionButton };
```

`'action'` IS a built-in renderer id (registered in `:types`), unlike custom names which go through `:components`.

`MyActionButton` reads `formAction: { id, label }` off `TAsComponentProps` and must emit `'action'` with the id when clicked.

## Multi-action forms

Declare multiple action phantoms; they each dispatch through the single `action` event:

```atscript
@meta.label 'Item'
export interface Item {
    id: number
    name: string

    @ui.form.action 'duplicate', 'Duplicate'
    duplicate: ui.action

    @ui.form.action 'archive', 'Archive'
    archive: ui.action

    @ui.form.action 'delete', 'Delete'
    delete: ui.action
}
```

```vue
<AsForm
  :def="def"
  :form-data="formData"
  :types="types"
  @submit="save"
  @action="
    (name, data) => {
      if (name === 'duplicate') duplicate(data);
      if (name === 'archive') archive(data);
      if (name === 'delete') remove(data);
    }
  "
/>
```

The submit button (driven by `@ui.form.submit.text`) is independent — it always sits at the form's footer slot. Actions render inline as regular fields, in the order they appear in the `.as` interface.

Unhandled action names emit `unsupported-action` instead of `action`:

```typescript
function supportsAction(def: FormDef, actionId: string): boolean {
  return def.fields.some((f) => {
    const a = getFieldMeta(f.prop, UI_FORM_ACTION);
    if (a?.id === actionId) return true;
    return getFieldMeta(f.prop, WF_ACTION_WITH_DATA) === actionId;
  });
}
```

Useful when shared chrome (e.g. a workflow root) dispatches actions through the form and you need to differentiate "I forgot to wire this" from "no field claims this id".

## Below-submit placement + alt-action text/align

`@ui.form.pushDown` moves a field into its own grid **below** the submit button instead of inline above it. The default `AsAction` also reads `text` and `align` off `@ui.form.attr`. Together they produce the centred "Already have an account? Sign in" link under a sign-up button.

```atscript
@ui.form.pushDown
@ui.form.attr 'text', 'Already have an account?'
@ui.form.attr 'align', 'center'
@ui.form.action 'sign-in', 'Sign in'
signIn: ui.action
```

| Annotation                                             | Effect                                                                                                                                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ui.form.pushDown`                                    | Field renders in a second `as-form-grid` below submit (same 12-col grid; `@ui.form.order` / `@ui.form.grid.*` honoured). `FormDef` exposes the partition as `def.mainFields` (above) / `def.pushDownFields` (below). |
| `@ui.form.attr 'text', '…'`                            | Text before the link → `text [link]`. `AsAction` reads it as the `text` prop.                                                                                                                                        |
| `@ui.form.attr 'align', 'left' \| 'center' \| 'right'` | Row alignment → `as-action-{left,center,right}` (safelisted in the ui-styles preset). Default `left`.                                                                                                                |

Rules:

- `text` / `align` are consumed by the default `AsAction` only (`ui.action` phantom fields). The inline-on-input action (field footer) ignores them.
- `@ui.form.pushDown` changes placement only — the `action` emit contract is unchanged. It is a per-field flag on `FormFieldDef.pushDown`; only top-level fields are partitioned (nested object grids render all their fields).
- `@ui.form.attr` forwards arbitrary name/value pairs as component props (`multiple`, `mergeStrategy: replace`) — the same mechanism custom components use; nothing in core special-cases `text` / `align`.
- All three work unchanged in `<AsWfForm>`: it renders through `<AsForm>`, and `@atscript/moost-wf` serializes `ui.form.pushDown` / `ui.form.attr` over the wire.

## Inline action on an input field

`@ui.form.action` is not limited to `ui.action` phantom fields. Placed on a regular input (string, password, number, …) it renders a link-styled button in the field's footer (right-aligned next to any error/hint) and dispatches `action` with the same `(name, data)` signature as the phantom-field variant. Disabling the field also dims the link.

```atscript
@meta.label 'Sign In'
export interface LoginForm {
    @meta.label 'Username'
    username: string

    @meta.label 'Password'
    @ui.type 'password'
    @ui.form.action 'forgot-password', 'Forgot password?'
    password: string
}
```

In a workflow form (`<AsWfForm>`) the click forwards to `useWfForm().action(id)` and the step receives it via `@WfAction()` from `@atscript/moost-wf`:

```ts
@Step("login-credentials")
async enterCredentials(
  @WorkflowParam("context") ctx: LoginCtx,
  @WfAction() action: string | undefined,
  @WfInput({ pass: true }) input?: LoginForm,
) {
  if (action === "forgot-password") {
    ctx.recovery = true;
    return;
  }
  // …normal credential flow
}
```

## Submit button controls

| Mechanism                           | Effect                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@ui.form.submit.text 'Send'`       | Static text. (Default: `"Submit"`.)                                                                     |
| `@ui.form.fn.submit.text '...'`     | Computed text — `(data, context) => string`. Requires `@atscript/ui-fns`.                               |
| `@ui.form.fn.submit.disabled '...'` | Computed disabled state — `(data, context) => boolean`. Requires `@atscript/ui-fns`.                    |
| `hide-submit` prop on AsForm        | Hide the default button entirely. (Empty `<template #form.submit />` does NOT suppress.)                |
| `#form.submit` slot                 | Replace the button entirely. Receives `{ disabled, text, clearErrors, reset, setErrors, formContext }`. |

```atscript
@meta.label 'User'
@ui.form.fn.submit.text '(data) => data.id ? "Update user" : "Create user"'
@ui.form.fn.submit.disabled '(data) => !data.email'
export interface User {
    id?: number
    email: string
    name: string
}
```

The form-level submit fns are read via `resolveFormProp` from the root type (not from any individual field).

## FK references — @db.rel.FK

A field marked as a foreign-key reference renders with `AsRef` (value-help picker) when the target type advertises an HTTP path:

```atscript
// src/category.as
@meta.label 'Category'
@db.table 'categories'
@db.http.path '/api/categories'
export interface Category {
    @meta.id
    @ui.dict.label
    @ui.dict.searchable
    id: number

    @meta.label 'Name'
    @ui.dict.searchable
    @ui.dict.filterable
    name: string
}

// src/product.as
import { Category } from './category.as'

@meta.label 'Product'
@db.table 'products'
export interface Product {
    @meta.id
    id: number

    @meta.label 'Name'
    name: string

    @meta.label 'Category'
    @db.rel.FK 'Category'
    categoryId: number
}
```

For details on `@db.rel.FK` semantics, schema sync, and `@ui.dict.*` see the **atscript-db** skill.

`AsRef` is registered under the built-in `ref` renderer id. When the target's `@db.http.path` is unreachable, AsRef falls back to a plain text input.

## ValueHelpClient flow

`AsRef` uses `useAsValueHelp(opts)` which wraps the framework-agnostic `ValueHelpClient` from `@atscript/ui`. The picker:

1. Resolves the target's metadata once (`resolveValueHelp(url)`) — caches per-URL.
2. On open / search input, queries the target (debounced 300 ms, limit 20).
3. On select, commits the value of the FK's `targetField` (typically `id`) to the model.

```typescript
const vh = useAsValueHelp({
  info, // ValueHelpInfo: { url, targetField }
  model: props.model, // bind the FK value
  onBlur: props.onBlur,
});

// vh.resolved        ShallowRef<ResolvedValueHelp | null>
// vh.status          Ref<'loading' | 'ready' | 'error'>
// vh.searchText      Ref<string>   (write to trigger debounced search)
// vh.results         ShallowRef<Record<string, unknown>[]>
// vh.searching       Ref<boolean>
// vh.labelIsFkValue  ComputedRef<boolean>  (target label === target id field)
// vh.kickoff()       Pre-resolve the target metadata
// vh.selectItem(it)  Commit `item[info.targetField]` to model
// vh.clear()         Reset model + searchText
```

When rolling your own picker without the Vue composable, drop down to the framework-agnostic primitives from `@atscript/ui`:

```ts
import { extractValueHelp, resolveValueHelp, ValueHelpClient } from "@atscript/ui";
import { Client } from "@atscript/db-client";

const info = extractValueHelp(prop); // { url, targetField } | undefined
if (!info) return;

const resolved = await resolveValueHelp(info.url); // cached per URL
const vh = new ValueHelpClient(new Client(info.url));
const { items } = await vh.search(resolved, { text: "acme", mode: "form", limit: 20 });
// commit `item[info.targetField]` to your model
```

`resolveValueHelp(url)` caches per URL across the app — call `resetValueHelpCache()` to invalidate (e.g. on logout). `ValueHelpClient.search` accepts `{ text?, mode?: 'form' | 'filter', limit?, select? }`.

## `@ui.dict.*` on the target type

Annotations on the target type control how it renders inside an FK picker.

| Annotation            | Effect                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `@ui.dict.label`      | Mark the field whose value is shown as the row's display label.                              |
| `@ui.dict.descr`      | Secondary text under the label.                                                              |
| `@ui.dict.searchable` | Include in the picker's free-text search (`?$search=`).                                      |
| `@ui.dict.filterable` | Available as a filter dropdown in the picker UI.                                             |
| `@ui.dict.sortable`   | Sortable in the picker.                                                                      |
| `@ui.dict.attr`       | Mark the field as an additional attribute column shown in table-mode value help. Repeatable. |

Example — a target type optimized for picker UX:

```atscript
@db.table 'users'
@db.http.path '/api/users'
export interface User {
    @meta.id
    id: number

    @meta.label 'Email'
    @ui.dict.label
    @ui.dict.searchable
    email: string

    @meta.label 'Name'
    @ui.dict.descr
    @ui.dict.searchable
    name: string

    @meta.label 'Role'
    @ui.dict.filterable
    role: 'admin' | 'user'
}
```

In any picker that targets `User` (FK or other), the row renders as `email` + muted `name`, search hits both, role filter is available.

For the full `@ui.dict.*` reference see the general **atscript-ui** skill's `annotations.md`.

## clientFactory prop

`AsForm` (and `AsWfForm`, `AsTable`) accept a `:client-factory` prop that overrides how value-help HTTP clients are created. Use it to inject auth headers per-form / per-page.

```vue
<script setup lang="ts">
import type { ClientFactory } from "@atscript/vue-form";
import { Client } from "@atscript/db-client";

const clientFactory: ClientFactory = (url) =>
  new Client(url, {
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${token.value}` },
      }),
  });
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" :client-factory="clientFactory" />
</template>
```

Resolution chain:

1. Nearest-ancestor `:client-factory` prop (per-form override).
2. App-wide default set via `setDefaultClientFactory()` from `@atscript/ui`.
3. Built-in `(url) => new Client(url)`.

Apply once globally if every form needs the same auth wiring:

```typescript
// main.ts
import { setDefaultClientFactory } from "@atscript/vue-form";
import { Client } from "@atscript/db-client";

setDefaultClientFactory((url) => new Client(url, { fetch: authedFetch }));
```

`getDefaultClientFactory()` and `resetDefaultClientFactory()` are also exported (the latter primarily for tests).

For the same prop on workflow forms see the **atscript-ui-wf** skill.

## Recipes

### Minimal FK picker

```atscript
// src/country.as
@meta.label 'Country'
@db.table 'countries'
@db.http.path '/api/countries'
export interface Country {
    @meta.id
    @ui.dict.searchable
    code: string

    @meta.label 'Name'
    @ui.dict.label
    @ui.dict.searchable
    name: string
}

// src/customer.as
import { Country } from './country.as'

@meta.label 'Customer'
@db.table 'customers'
export interface Customer {
    @meta.id
    id: number

    @meta.label 'Name'
    name: string

    @meta.label 'Country'
    @db.rel.FK 'Country'
    countryCode: string
}
```

```vue
<script setup lang="ts">
import { AsForm, createAsFormDef, createDefaultTypes } from "@atscript/vue-form";
import { Customer } from "./customer.as";

const { def, formData } = createAsFormDef(Customer);
const types = createDefaultTypes();
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" />
</template>
```

The `countryCode` field renders as a search-and-pick combobox. Typing into it queries `/api/countries` with `$search` on `code` and `name`. Selecting a row commits `country.code` (the target's `@meta.id` field, since no other `targetField` is configured) to `customer.countryCode`.

### Custom FK renderer

Re-use `useAsValueHelp` for the data flow; bring your own UI:

```vue
<script setup lang="ts">
import { useAsValueHelp, AsFieldShell } from "@atscript/vue-form";
import type { TAsComponentProps } from "@atscript/vue-form";

const props = defineProps<TAsComponentProps>();
const vh = props.valueHelp
  ? useAsValueHelp({ info: props.valueHelp, model: props.model, onBlur: props.onBlur })
  : undefined;
</script>

<template>
  <AsFieldShell v-bind="$props">
    <template #default="{ inputId }">
      <input v-if="!vh" :id="inputId" v-model="model.value" @blur="onBlur" />
      <template v-else>
        <input :id="inputId" v-model="vh.searchText.value" @blur="onBlur" />
        <ul v-if="vh.results.value.length">
          <li
            v-for="item in vh.results.value"
            :key="String(item[vh.resolved.value!.idField])"
            @click="vh.selectItem(item)"
          >
            {{ item[vh.resolved.value!.labelField] }}
          </li>
        </ul>
      </template>
    </template>
  </AsFieldShell>
</template>
```

Register globally via the `:types` map:

```typescript
const types = { ...createDefaultTypes(), ref: MyFkPicker };
```

— or per-field via `@ui.form.component 'compact-fk'` + `:components`.
