# @atscript/vue-form

Type-driven form rendering for Atscript with Vue 3.

## Installation

```bash
pnpm add @atscript/vue-form
```

## Overview

`vue-form` provides Vue 3 components and composables for rendering forms from Atscript schemas. All components use the `as-` prefix.

## Components

### Primary components

These are the components you tag in your templates. They're auto-imported by `AsResolver` if you use it (see [Styling](../guide/styling#asresolver-auto-import)).

| Component    | Description                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| `AsForm`     | Root form component — renders all fields from a definition.                  |
| `AsField`    | Individual field renderer — useful when you want to lay out fields manually. |
| `AsIterator` | Iterates over an object's fields, rendering each as `AsField`.               |

### Default components (swap targets)

These back the `:types` map on `<AsForm>`. You usually consume them through `createDefaultTypes()`, but you can import any of them on its own to wrap or extend a default. They are **not** auto-imported by `AsResolver` — write the `import` line explicitly when you need one.

| Component     | Used for `@ui.type`                      |
| ------------- | ---------------------------------------- |
| `AsInput`     | `text`, `textarea`, `password`, `number` |
| `AsSelect`    | `select`                                 |
| `AsRadio`     | `radio`                                  |
| `AsCheckbox`  | `checkbox`                               |
| `AsParagraph` | `paragraph`                              |
| `AsAction`    | `action`                                 |
| `AsObject`    | nested object fields                     |
| `AsArray`     | array fields                             |
| `AsUnion`     | union-type fields                        |
| `AsTuple`     | tuple-type fields                        |
| `AsRef`       | `ref` (foreign-key / value-help) fields  |

## Composables

### `useForm(TypeRef)`

Creates a reactive form definition and form data from an Atscript type reference.

```typescript
import { useForm } from "@atscript/vue-form";
import { MyForm } from "./forms/my-form.as";

const { def, formData } = useForm(MyForm);
```

### `createDefaultTypes()`

Returns a type map with default HTML input components for each field type.

```typescript
import { createDefaultTypes } from "@atscript/vue-form";

const types = createDefaultTypes();
// Customize by replacing entries:
// types.set('text', MyCustomTextInput)
```
