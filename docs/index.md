---
layout: home

hero2:
  text: "Your types are your UI"
  tagline: "Automated forms, smart tables, and multi-step HTTP workflows — generated from annotated atscript types. No boilerplate. No manual wiring. Just schema."

actions:
  - theme: brand
    text: Quick Start
    link: /guide/quick-start
  - theme: alt
    text: View on GitHub
    link: https://github.com/moostjs/atscript-ui
---

## The atscript ecosystem

- **[atscript.dev](https://atscript.dev)** — the `.as` language: types, `@meta.*`/`@expect.*` annotations, codegen, validation.
- **[db.atscript.dev](https://db.atscript.dev)** — database adapters, `@db.*` annotations, schema sync, REST surface.
- **ui.atscript.dev** (you are here) — UI components driven by the same annotated types.

## What's inside

- **[Forms](/forms/)** — `<AsForm>` renders any annotated type as a working form, with validation, arrays, nested objects, unions, and tuples.
- **[Tables](/tables/)** — `<AsTableRoot>` + `<AsTable>` reads `@ui.table.*` and `@db.*` metadata to render searchable, filterable, sortable, paginated (or virtualized) tables.
- **[Workflows](/workflows/)** — `<AsWfForm>` + `@atscript/moost-wf` implement HTTP round-trip multi-step forms driven by atscript types on both sides.
- **[Styling](/styling/)** — UnoCSS preset, `as-*` shortcut tree, semantic icons, and vunor-driven theming.
