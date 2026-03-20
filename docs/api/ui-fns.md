# @atscript/ui-fns

Dynamic fn-compiled field properties for `@atscript/ui-core`.

## Installation

```bash
pnpm add @atscript/ui-fns
```

## Overview

`ui-fns` adds support for dynamic field properties that are compiled at runtime using `new Function`. This is an opt-in package — use it when you need computed field behaviors like conditional visibility or dynamic validation.

::: warning
This package uses `new Function()` for runtime compilation. Ensure your Content Security Policy allows `unsafe-eval` if you use this in a browser environment.
:::
