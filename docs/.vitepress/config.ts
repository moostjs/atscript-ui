import { defineConfig } from "vitepress";
import llmstxtPlugin from "vitepress-plugin-llmstxt";

const atscriptGrammar = {
  name: "atscript",
  scopeName: "source.atscript",
  fileTypes: ["atscript", "as"],
  patterns: [
    { include: "#annotation-with-args" },
    { include: "#annotations" },
    { include: "#comments" },
    { include: "#strings" },
    { include: "#property-names" },
    { include: "#import-statement" },
    { include: "#keywords" },
    { include: "#numbers" },
    { include: "#operators" },
    { include: "#punctuation" },
    { include: "#global-types" },
  ],
  repository: {
    comments: {
      patterns: [
        { name: "comment.line.double-slash.atscript", match: "//.*$" },
        {
          name: "comment.block.atscript",
          begin: "/\\*",
          end: "\\*/",
          patterns: [
            {
              match: "\\*/",
              name: "invalid.illegal.stray.end-of-comment.atscript",
            },
          ],
        },
      ],
    },
    strings: {
      patterns: [{ match: "'([^']*)'|\"([^\"]*)\"", name: "string.quoted.atscript" }],
    },
    "import-statement": {
      patterns: [
        {
          name: "meta.import.statement",
          begin: "(?<![A-Za-z0-9_$])\\bimport\\b(?!\\s*[:=])",
          beginCaptures: {
            "0": { name: "keyword.control.import.atscript" },
          },
          end: "(?=;|$)",
          patterns: [
            { match: "\\bfrom\\b", name: "keyword.control.from.atscript" },
            {
              begin: "\\{",
              beginCaptures: { "0": { name: "punctuation.section.braces" } },
              end: "\\}",
              endCaptures: { "0": { name: "punctuation.section.braces" } },
              patterns: [
                {
                  name: "entity.name.type.atscript",
                  match: "\\b[A-Za-z_$][A-Za-z0-9_$]*\\b",
                },
              ],
            },
            {
              match: "'([^']*)'|\"([^\"]*)\"",
              name: "string.quoted.import.atscript",
            },
          ],
        },
      ],
    },
    keywords: {
      patterns: [
        {
          match: "(?<![A-Za-z0-9_$])\\bexport\\b(?!\\s*[:=])",
          name: "keyword.control.export.atscript",
        },
        {
          match: "(\\b(?:type|interface)\\b)\\s+([A-Za-z_][A-Za-z0-9_]*)",
          captures: {
            "1": { name: "storage.type.atscript" },
            "2": { name: "entity.name.type.atscript" },
          },
        },
        {
          match:
            "(\\bannotate\\b)\\s+([A-Za-z_][A-Za-z0-9_]*)(?:\\s+(as)\\s+([A-Za-z_][A-Za-z0-9_]*))?",
          captures: {
            "1": { name: "storage.type.atscript" },
            "2": { name: "entity.name.type.atscript" },
            "3": { name: "keyword.control.as.atscript" },
            "4": { name: "entity.name.type.atscript" },
          },
        },
      ],
    },
    numbers: {
      patterns: [{ name: "constant.numeric.atscript", match: "\\b\\d+(\\.\\d+)?\\b" }],
    },
    operators: {
      patterns: [{ name: "keyword.operator.atscript", match: "[|&=?]" }],
    },
    annotations: {
      patterns: [{ name: "keyword.control.at-rule.atscript", match: "@[A-Za-z0-9_.]+" }],
    },
    "annotation-with-args": {
      patterns: [
        {
          begin: "(@[A-Za-z0-9_.]+)",
          beginCaptures: {
            "1": { name: "keyword.control.at-rule.atscript" },
          },
          end: "(?=$|\\n|\\r|;)",
          patterns: [
            { name: "constant.numeric.atscript", match: "\\b\\d+(\\.\\d+)?\\b" },
            {
              name: "string.quoted.single.atscript",
              begin: "'",
              end: "(?:'|\\n)",
              patterns: [{ match: "\\\\.", name: "constant.character.escape.atscript" }],
            },
            {
              name: "string.quoted.double.atscript",
              begin: '"',
              end: '(?:"|\\n)',
              patterns: [{ match: "\\\\.", name: "constant.character.escape.atscript" }],
            },
            {
              name: "constant.language.boolean.atscript",
              match: "\\b(?:true|false|undefined|null)\\b",
            },
          ],
        },
      ],
    },
    punctuation: {
      patterns: [
        { name: "punctuation.separator.comma.atscript", match: "," },
        { name: "punctuation.terminator.statement.atscript", match: ";" },
        { name: "punctuation.separator.key-value.atscript", match: ":" },
        { name: "punctuation.section.parens.begin.atscript", match: "\\(" },
        { name: "punctuation.section.parens.end.atscript", match: "\\)" },
        { name: "punctuation.section.braces.begin.atscript", match: "\\{" },
        { name: "punctuation.section.braces.end.atscript", match: "\\}" },
        { name: "punctuation.section.brackets.begin.atscript", match: "\\[" },
        { name: "punctuation.section.brackets.end.atscript", match: "\\]" },
      ],
    },
    "global-types": {
      patterns: [
        {
          name: "support.type.primitive.atscript",
          match:
            "\\b(?:number|string|boolean|void|undefined|null|never|any|unknown|bigint|symbol)\\b(?!\\s*:)",
        },
        {
          name: "support.type.semantic.atscript",
          match: "\\b(string|number|boolean|mongo)\\.(\\w+)\\b",
          captures: {
            "1": { name: "support.type.primitive.atscript" },
            "2": { name: "support.type.semantic.atscript" },
          },
        },
      ],
    },
    "property-names": {
      patterns: [
        {
          name: "variable.other.property.atscript",
          match: "\\b([A-Za-z_$][A-Za-z0-9_$]*)\\b(?=\\s*:)",
        },
        {
          name: "variable.other.property.optional.atscript",
          match: "\\b([A-Za-z_$][A-Za-z0-9_$]*)\\b(?=\\?\\s*:)",
        },
      ],
    },
  },
};

const guideSidebar = [
  {
    text: "Getting Started",
    items: [
      { text: "Overview", link: "/guide/" },
      { text: "Quick Start", link: "/guide/quick-start" },
      { text: "Installation", link: "/guide/installation" },
      { text: "The .as File", link: "/guide/the-as-file" },
      { text: "Ecosystem Map", link: "/guide/ecosystem" },
    ],
  },
];

const formsSidebar = [
  {
    text: "Forms",
    items: [
      { text: "Overview", link: "/forms/" },
      { text: "Hello World", link: "/forms/hello-world" },
      { text: "Annotations Reference", link: "/forms/annotations" },
      { text: "Field Types & Type Map", link: "/forms/field-types" },
      { text: "Validation", link: "/forms/validation" },
      { text: "Arrays", link: "/forms/arrays" },
      { text: "Nested Objects", link: "/forms/nested-objects" },
      { text: "Unions", link: "/forms/unions" },
      { text: "Tuples", link: "/forms/tuples" },
      { text: "Dynamic Fields", link: "/forms/dynamic-fields" },
      { text: "Grid Layout", link: "/forms/grid-layout" },
      { text: "Actions", link: "/forms/actions" },
      { text: "References (FK)", link: "/forms/references" },
    ],
  },
  {
    text: "Customization",
    items: [
      { text: "Three Levels of Override", link: "/forms/customization" },
      { text: "Custom Components", link: "/forms/custom-components" },
      { text: "Collapsible Sections", link: "/forms/collapsible-sections" },
      { text: "Aooth Components", link: "/forms/aooth-components" },
      { text: "Locale & Currency", link: "/forms/locale" },
    ],
  },
];

const tablesSidebar = [
  {
    text: "Tables",
    items: [
      { text: "Overview", link: "/tables/" },
      { text: "Hello World", link: "/tables/hello-world" },
      { text: "Annotations Reference", link: "/tables/annotations" },
      { text: "Query Function", link: "/tables/query-function" },
      { text: "Filtering", link: "/tables/filtering" },
      { text: "Sorting", link: "/tables/sorting" },
      { text: "Pagination & Virtualization", link: "/tables/pagination" },
      { text: "Cells", link: "/tables/cells" },
      { text: "Custom Cells", link: "/tables/custom-cells" },
      { text: "Config Dialog", link: "/tables/config-dialog" },
      { text: "URL State", link: "/tables/url-state" },
      { text: "Presets", link: "/tables/presets" },
      { text: "Actions & Selection", link: "/tables/actions" },
      { text: "Edit Forms with OCC", link: "/tables/edit-form-occ" },
    ],
  },
  {
    text: "Customization",
    items: [
      { text: "Slot Overrides & Swaps", link: "/tables/customization" },
      { text: "Server-Side Presets", link: "/tables/server-presets" },
    ],
  },
];

const workflowsSidebar = [
  {
    text: "Workflows",
    items: [
      { text: "Overview", link: "/workflows/" },
      { text: "Hello World", link: "/workflows/hello-world" },
    ],
  },
  {
    text: "Server (moost-wf)",
    items: [
      { text: "Authoring Flows", link: "/workflows/server-authoring" },
      { text: "Form Input", link: "/workflows/form-input" },
      { text: "Actions", link: "/workflows/actions" },
      { text: "Context Passing", link: "/workflows/context" },
      { text: "State Persistence", link: "/workflows/state-persistence" },
      { text: "Outlets & Resume", link: "/workflows/outlets-resume" },
    ],
  },
  {
    text: "Client (vue-wf)",
    items: [
      { text: "AsWfForm", link: "/workflows/client" },
      { text: "Finish Screens", link: "/workflows/finish-screens" },
      { text: "Recipes", link: "/workflows/recipes" },
    ],
  },
];

const stylingSidebar = [
  {
    text: "Styling",
    items: [
      { text: "Overview", link: "/styling/" },
      { text: "Installation", link: "/styling/installation" },
      { text: "Theme & Palette", link: "/styling/theme" },
      { text: "Icons", link: "/styling/icons" },
      { text: "The as-* Shortcut System", link: "/styling/shortcuts" },
      { text: "Pre-built CSS", link: "/styling/prebuilt-css" },
    ],
  },
];

const apiSidebar = [
  {
    text: "Framework-Agnostic Core",
    items: [
      { text: "@atscript/ui", link: "/api/ui" },
      { text: "@atscript/ui-fns", link: "/api/ui-fns" },
      { text: "@atscript/ui-table", link: "/api/ui-table" },
      { text: "@atscript/ui-styles", link: "/api/ui-styles" },
    ],
  },
  {
    text: "Vue 3",
    items: [
      { text: "@atscript/vue-form", link: "/api/vue-form" },
      { text: "@atscript/vue-table", link: "/api/vue-table" },
      { text: "@atscript/vue-wf", link: "/api/vue-wf" },
      { text: "@atscript/vue-aooth", link: "/api/vue-aooth" },
    ],
  },
  {
    text: "Server (Moost)",
    items: [
      { text: "@atscript/moost-wf", link: "/api/moost-wf" },
      { text: "@atscript/moost-ui-presets", link: "/api/moost-ui-presets" },
    ],
  },
];

export default defineConfig({
  title: "Atscript UI",
  description:
    "Type-driven UI components for Atscript — automated forms, smart tables, and HTTP workflow forms from annotated types",
  lang: "en-US",
  lastUpdated: true,
  cleanUrls: true,
  srcExclude: ["superpowers/**"],

  vite: {
    plugins: [
      llmstxtPlugin({
        hostname: "ui.atscript.dev",
      }),
    ],
  },

  head: [
    ["link", { rel: "icon", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#471AEC" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Atscript UI" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Type-driven UI components for Atscript — automated forms, smart tables, and HTTP workflow forms from annotated types",
      },
    ],
  ],

  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
    lineNumbers: true,
    languages: ["typescript", "javascript", "json", "bash", "vue", atscriptGrammar as any],
  },

  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Atscript UI",

    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Forms", link: "/forms/" },
      { text: "Tables", link: "/tables/" },
      { text: "Workflows", link: "/workflows/" },
      { text: "Styling", link: "/styling/" },
      { text: "API", link: "/api/ui" },
    ],

    sidebar: {
      "/guide/": guideSidebar,
      "/forms/": formsSidebar,
      "/tables/": tablesSidebar,
      "/workflows/": workflowsSidebar,
      "/styling/": stylingSidebar,
      "/api/": apiSidebar,
    },

    socialLinks: [{ icon: "github", link: "https://github.com/moostjs/atscript-ui" }],

    search: {
      provider: "local",
    },

    editLink: {
      pattern: "https://github.com/moostjs/atscript-ui/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025-present Artem Maltsev",
    },
  },
});
