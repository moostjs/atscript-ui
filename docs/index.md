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

## AI Agent Skill

Atscript UI ships a bundle of skills for AI coding agents (Claude Code, Cursor, Windsurf, Codex, etc.). One command installs all five sub-skills — covering forms, tables, workflows, styling, and the framework-agnostic core:

```bash
npx skills add moostjs/atscript-ui
```

Includes `atscript-ui` (core + `@ui.*` annotations), `atscript-ui-forms` (`<AsForm>`), `atscript-ui-tables` (`<AsTableRoot>` + `<AsTable>`), `atscript-ui-wf` (`<AsWfForm>` + `moost-wf`), and `atscript-ui-styles` (UnoCSS preset, `as-*` shortcuts, icons, theming).

You will likely also want the companion skills:

```bash
npx skills add moostjs/atscript      # .as syntax, @meta.* / @expect.*, asc, Validator
npx skills add moostjs/atscript-db   # @db.* annotations, adapters, moost-db REST, browser client
npx skills add moostjs/moostjs       # Moost framework (controllers, DI, interceptors) — needed for moost-wf
```

Learn more about AI agent skills at [skills.sh](https://skills.sh).
