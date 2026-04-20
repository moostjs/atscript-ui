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
    ],
  },
];

const formSidebar = [
  {
    text: "Forms",
    items: [
      { text: "Overview", link: "/forms/" },
      { text: "Schema Annotations", link: "/forms/annotations" },
      { text: "Field Types", link: "/forms/field-types" },
      { text: "Validation", link: "/forms/validation" },
      { text: "Arrays & Nested", link: "/forms/arrays" },
    ],
  },
  {
    text: "Vue Components",
    items: [
      { text: "AsForm", link: "/forms/as-form" },
      { text: "AsField", link: "/forms/as-field" },
      { text: "Customization", link: "/forms/customization" },
    ],
  },
];

const apiSidebar = [
  {
    text: "Packages",
    items: [
      { text: "ui", link: "/api/ui" },
      { text: "ui-fns", link: "/api/ui-fns" },
      { text: "vue-form", link: "/api/vue-form" },
    ],
  },
];

export default defineConfig({
  title: "Atscript UI",
  description:
    "Type-driven UI components for Atscript — automated forms and smart tables from annotated types",
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
          "Type-driven UI components for Atscript — automated forms and smart tables from annotated types",
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
      { text: "API", link: "/api/ui-core" },
    ],

    sidebar: {
      "/guide/": guideSidebar,
      "/forms/": formSidebar,
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
