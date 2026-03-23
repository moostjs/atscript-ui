# @atscript/ui

Framework-agnostic runtime for form and table definitions from Atscript annotated types.

## Installation

```bash
pnpm add @atscript/ui
```

## Overview

`@atscript/ui` reads compiled Atscript type metadata and produces structured form and table definitions. It is the foundation that framework-specific packages (like `vue-form`) build upon.

This package has no dependency on Vue or any other UI framework.

## Plugin

`@atscript/ui/plugin` exports a plugin that registers all static `@ui.*` annotations and UI primitives (`ui.select`, `ui.radio`, `ui.checkbox`, `ui.paragraph`, `ui.action`).

```ts
import uiPlugin from "@atscript/ui/plugin";

export default {
  plugins: [uiPlugin()],
};
```
