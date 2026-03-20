# @atscript/vue-form

Type-driven form rendering for Atscript with Vue 3.

## Installation

```bash
pnpm add @atscript/vue-form
```

## Overview

`vue-form` provides Vue 3 components and composables for rendering forms from Atscript schemas. All components use the `as-` prefix.

## Components

| Component | Description                                                |
| --------- | ---------------------------------------------------------- |
| `AsForm`  | Root form component — renders all fields from a definition |
| `AsField` | Individual field renderer                                  |

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
