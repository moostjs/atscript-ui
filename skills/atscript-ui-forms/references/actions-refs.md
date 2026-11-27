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
import { Category } from './category'

@meta.label 'Product'
@db.table 'products'
export interface Product {
    @meta.id
    id: number

    @meta.label 'Name'
    name: string

    @meta.label 'Category'
    @db.rel.FK
    categoryId: Category.id
}
```

For details on `@db.rel.FK` semantics, schema sync, and `@ui.dict.*` see the **atscript-db** skill.

`AsRef` is registered under the built-in `ref` renderer id. When the target's `@db.http.path` is unreachable, AsRef falls back to a plain text input.

The × (shown with a value or typed search text; never when disabled / read-only) empties the field as emptying an input does, and the search text with it; focus back in the input (since 0.1.177 — before it only emptied the search text): optional → `undefined` ("Not set" once focus leaves; patch `null` for a stored value, clean when nothing was stored); required → `""` for a string key, `null` for any other key (number id) — never its `@meta.default`; the `@meta.required` / type error shows by the usual timing, so a cleared required key blocks the submit. `AsRef` needs no `<AsForm>` around it for this.

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
// vh.selectItem(it)  Commit `item[info.targetField]` to model, write the fills, onBlur (the one pick path)
// vh.clear(value?)   model = value (undefined when omitted), clears what the last pick filled, searchText = "", re-lists all matches
// vh.scope           ComputedRef<{ filter?, pinned }> — the binding's filter with the form's host values (0.1.190)
// options.open?      Ref<boolean> — re-search on host change only while open (0.1.190); options.limit? rows per search
```

When rolling your own picker without the Vue composable, drop down to the framework-agnostic primitives from `@atscript/ui`:

```ts
import { extractValueHelp, resolveValueHelp, ValueHelpClient } from "@atscript/ui";
import { Client } from "@atscript/db-client";

// Already resolved for you when you have a form def: `field.valueHelpInfo`
// (since 0.1.134) — `createFormDef` walks the chain once per field, and
// `<AsField>` passes it to the control as the `valueHelp` prop. Call
// `extractValueHelp` directly only when you have a bare prop and no def.
const info = extractValueHelp(prop); // { url, targetField } | undefined
if (!info) return;

const resolved = await resolveValueHelp(info.url); // cached per URL
const vh = new ValueHelpClient(new Client(info.url));
const { items } = await vh.search(resolved, { text: "acme", mode: "form", limit: 20 });
// commit `item[info.targetField]` to your model
```

### Binding without a foreign key

_Since 0.1.148._ `@ui.valueHelp` binds a field to a dictionary with no `@db.rel.FK` (composite-key dictionaries, view fields). `extractValueHelp` reads it first and it beats an FK on the field or its chain; it returns `{ url, targetField, filter?, pinned?, hostFilter?, fill?, columns? }`, and `useAsValueHelp` passes the scope and `info` to `ValueHelpClient.search`, so the picker is scoped and commits `item[targetField]`. A target without `@db.http.path` is ignored (the FK walk runs); workflow forms get the same binding. Annotation reference: the atscript-ui skill, `annotations.md`.

### Values of the form, fills, dropdown (since 0.1.190)

```atscript
export interface Customer {
    country?: string
    @ui.valueHelp City, 'id', `country = Customer.country and active = true`
    @ui.valueHelp.fill 'cityName', 'name'
    @ui.valueHelp.fill 'country', 'country'
    city?: string
    cityName?: string
}
```

- **Host references** (`country = Customer.country`): `useAsValueHelp` reads the sibling (`useAsData().siblingValue`) and searches with `valueHelpScope(info, read).filter` (exposed as `vh.scope`). Empty sibling → condition dropped. A host change re-searches an open picker at once, a closed one on its next open (`UseAsValueHelpOptions.open`; AsRef passes its open state). A value the new scope excludes is kept.
- **Pick path**: AsRef's combobox commits through `vh.selectItem(row)` — model, then each fill via `setSibling` (a committed edit, unchanged values skipped), then `onBlur()`. So every ref pick now validates/touches the field at once (changed in 0.1.190). A custom picker must call `selectItem(row)` to get fills.
- **Clearing**: `vh.clear(value)` also writes `undefined` into each fill target the last pick wrote while it still holds that value; never a `hostFilter` local (a field that both scopes and is filled). Resets, loads, user edits, other bindings' fills: nothing cleared; fills do not cascade.
- **Dropdown (6b)**: `@ui.form.type 'select'` / `'radio'` on a bound field with no static options → AsField loads the dictionary (`$limit` = `VALUE_HELP_OPTIONS_CAP + 1` = 201, scope + select rule; `valueHelpOptions` maps rows) and passes them as `options`; the model setter routes picks through `selectItem`, an empty value through `clear`. AsSelect renders an empty first option for a bound field. 201 rows → the `ref` types-map entry renders instead (one dev warning). Host changes reload the list.
- **Select rule**: `ValueHelpSearchOptions.select` now ADDS to `valueHelpSelect(resolved, info, mode)` (keys + label + descr [+ attrs] + targetField + columns + fill targets). The non-searchable regex fallback stays on key / label / descr.
- `createFormDef` drops fills whose sibling is absent (also a field the served `/meta` type leaves out — no key is ever written) / derived / navigation. A `@meta.readonly` sibling IS written (0.1.191+; before, skipped): the server-computed text next to a code; the patch sends it like any app-set value. A field of a namespace object (dotted path in the def, `shipping.city`) gets its `hostFilter[].local` and `fill[].local` prefixed with its parent (`shipping.country`) — its siblings, not the form root's.
- **The row picked**: AsRef hands the clicked / Enter-ed row from `ComboboxItem @select` straight to `selectItem` (also a row whose committed value the field already holds — 0.1.191+). Since 0.1.191 the items' `value` and `:key` are the row's primary key and the combobox's model is the picked row's key, so `data-state="checked"` marks the row picked, not every row holding the value (a loaded value: the one loaded row holding it, else none; unchanged once a search is typed during this open and while the value is unchanged, so a typed or emptied search stays; rows arriving before that — the first read, a search at open — mark the row). The field's value for a native form rides a hidden `<input name>` of AsRef's own, disabled with the field. Each item's `as-ref-item-id` shows the committed value plus the values of `info.columns` that are other primary-key members (`7 · FR`). A dropdown value several rows hold is committed without fills. Never `results.find(r => r[targetField] === value)` in a custom picker — composite-key dictionaries repeat values.

### Picker dialog — AsRefPicker (since 0.1.190)

```ts
import { createDefaultTypes } from "@atscript/vue-form";
import { AsRefPicker } from "@atscript/vue-table";
const types = { ...createDefaultTypes(), ref: AsRefPicker };
```

`AsRefPicker` (vue-table, Tier 2) = `AsRef` + a button in its `trailing` slot + a "See all" entry in its `list-end` slot (always shown, no count). Both close the list and open `AsValueHelpDialog` (vue-table, Tier 2): `v-model:open`, props `{ info, scope?, search?, title?, clientFactory? }`, emits `pick(row)`; wire `pick` to the slot's `selectItem`. The dialog's inner table (internal `AsValueHelpTable`, `select: "single"`, shared with the filter dialog's `"multi"`) shows `info.columns` (else the dict view minus `scope.pinned`), `forceFilters` = `scope.filter`, `alwaysSelected` = `valueHelpSelect(resolved, info, "filter")`; "See all" seeds `searchTerm` with the typed text when the dictionary is searchable (else not carried). Enter / double-click → main action → `pick`. Disabled / read-only field: no button, no entry; a read-only AsRef opens no list. AsRef slot props (`TAsRefSlotProps`): `{ searchText, selectItem, scope, clientFactory?, close, focus }` (`focus()` focuses the input without opening the list, e.g. when the dialog closes). `as-ref-root` is a flex row since 0.1.190.

### Code with its text — @ui.valueLabel (since 0.1.190)

`AsField` reads `valueLabelOf(prop)` and, only for annotated fields, binds `valueLabel = arrangeText(String(model), siblingValue(field), arrangement)` (a computed bound apart from the memoised display props). `AsInputControl` shows it while `readonly` (a read-only number input renders as text then); `AsRef` passes it as the combobox `displayValue` while not focused or read-only — focused, the code. Undefined while the value is empty.

### Reference chains

_Since 0.1.134._ The FK does not have to sit on the field itself. For a view
field declared against an intermediate table — `errorCode: Issue.errorCode`,
where `Issue.errorCode: ErrorCode.code` is the link carrying `@db.rel.FK` —
`extractValueHelp` walks `prop.ref` → the referenced field → its own `ref` until
it finds a link with `@db.rel.FK` whose target declares `@db.http.path`, and
returns that dictionary's `{ url, targetField }`. The walk is depth-bounded and
cycle-safe; a chain with no FK link anywhere yields `undefined`.

The server resolves the same chains on its side: since `@atscript/db` 0.1.128
`/meta` and `/meta/form/:name` serialize such a field with `ref` pointing at the
TERMINAL field and `db.rel.FK: true` lifted onto it. Form defs built from a
compiled `.as` type and from `/meta` therefore agree on the dictionary.

`resolveValueHelp(url)` caches per URL in the browser (shared meta cache; never on the server) — bind it to the signed-in user with `setMetaCacheIdentity(key | null)` after login / logout / current-user reload (since 0.1.151; a new key resets it), or call `resetValueHelpCache()` to invalidate explicitly. Since 0.1.151 identical `search()` calls on one `Client` are shared in the browser (in-flight join + 5 s reuse; never on the server): `setValueHelpCacheTtl(ms)` tunes it (`0` = in-flight only, `< 0` = off); after writing a dictionary outside `<AsTable>` actions call `invalidateValueHelpCache(client?)` or pickers may show rows up to the TTL old (`resetMetaCache()` and table backend/delete actions clear it). `ValueHelpClient.search` accepts `{ text?, mode?: 'form' | 'filter', limit?, select?, filter?, valueField? }` (`filter` / `valueField` since 0.1.148).

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

const clientFactory: ClientFactory = (url, options) =>
  new Client(url, {
    ...options, // library-requested metaKey / metaStore (0.1.153), locale (0.1.165)
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

setDefaultClientFactory((url, options) => new Client(url, { ...options, fetch: authedFetch }));
```

`getDefaultClientFactory()` and `resetDefaultClientFactory()` are also exported (the latter primarily for tests). `getDefaultClientFactory()` returns a `TypedClientFactory` (0.1.164+): `getDefaultClientFactory()<typeof Product>(url)` is a `ClientLike<typeof Product>` with typed reads/writes; without a type argument it is the untyped `ClientLike`. The installed factory may be any function returning a `ClientLike` (0.1.190+; `Client` before): a `Client` (new or cached) or any object with `Client`'s public members. `ClientLike` is re-exported by `@atscript/ui`; `getMetaEntry().client`, `sharedPresetsClient()` and `useTableContext().client` are typed `ClientLike` too — annotate them `ClientLike<T>`, not `Client<T>`.

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
import { Country } from './country'

@meta.label 'Customer'
@db.table 'customers'
export interface Customer {
    @meta.id
    id: number

    @meta.label 'Name'
    name: string

    @meta.label 'Country'
    @db.rel.FK
    countryCode: Country.code
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
