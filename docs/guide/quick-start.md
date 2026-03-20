# Quick Start

## Installation

```bash
pnpm add @atscript/vue-form @atscript/ui-core @atscript/ui-fns
pnpm add -D unplugin-atscript @atscript/typescript
```

## Vite Setup

Add the Atscript plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import atscript from "unplugin-atscript/vite";

export default defineConfig({
  plugins: [atscript(), vue()],
});
```

## Define a Form Schema

Create a `.as` file with your form definition:

```atscript
@meta.label 'Contact Form'
@ui.submit.text 'Send'
export interface ContactForm {
  @meta.label 'Name'
  @ui.type 'text'
  @meta.required 'Name is required'
  name: string

  @meta.label 'Email'
  @ui.type 'text'
  @meta.required 'Email is required'
  email: string.email

  @meta.label 'Message'
  @ui.type 'textarea'
  message: string
}
```

## Render the Form

```vue
<script setup lang="ts">
import { AsForm, createDefaultTypes, useForm } from "@atscript/vue-form";
import { ContactForm } from "./forms/contact.as";

const types = createDefaultTypes();
const { def, formData } = useForm(ContactForm);

function onSubmit(data: unknown) {
  console.log("Submitted:", data);
}
</script>

<template>
  <AsForm :def="def" :form-data="formData" :types="types" @submit="onSubmit" />
</template>
```

That's it — labels, placeholders, validation, and the submit button are all generated from the schema.
