# @atscript/ui-fns

Dynamic `@ui.form.fn.*` / `@ui.table.fn.*` computed field properties and `@ui.form.validate` for `@atscript/ui`.

Static `@ui.*` annotations and UI primitives are provided by `@atscript/ui/plugin`.

## Installation

```bash
pnpm add @atscript/ui-fns
```

## Overview

`ui-fns` adds support for dynamic field properties that are compiled at runtime using `new Function`. This is an opt-in package — use it when you need computed field behaviors like conditional visibility or dynamic validation.

::: warning
This package uses `new Function()` for runtime compilation. Ensure your Content Security Policy allows `unsafe-eval` if you use this in a browser environment.
:::
