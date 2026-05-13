<script setup>
import { onMounted, nextTick, ref, watch } from "vue";
import { useData, useRoute } from "vitepress";
import DefaultTheme from "vitepress/theme";
import VPButton from "vitepress/dist/client/theme-default/components/VPButton.vue";
import SnippetForm from "./snippets/snippet-form.md";
import SnippetTable from "./snippets/snippet-table.md";
import SnippetWorkflow from "./snippets/snippet-workflow.md";

const { Layout } = DefaultTheme;
const { frontmatter } = useData();
const route = useRoute();

const copiedCmd = ref("");
let copyTimer;
async function copyCmd(cmd) {
  try {
    await navigator.clipboard.writeText(cmd);
    copiedCmd.value = cmd;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copiedCmd.value = "";
    }, 1400);
  } catch {
    // ignore
  }
}

function setupScrollAnimations() {
  nextTick(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll(".animate-in").forEach((el) => {
      el.classList.remove("visible");
      observer.observe(el);
    });
  });
}

onMounted(setupScrollAnimations);
watch(() => route.path, setupScrollAnimations);
</script>

<template>
  <Layout>
    <template #home-hero-before>
      <!-- ═══════════════════ Hero ═══════════════════ -->
      <div class="custom-hero">
        <div class="hero-grid-bg" aria-hidden="true"></div>
        <div class="hero-inner">
          <div class="hero-main">
            <p class="hero-kicker">
              UI layer for <a href="https://atscript.dev" class="kicker-link">Atscript</a>
            </p>
            <h1 class="hero-name">Atscript UI</h1>
            <p class="hero-text">{{ frontmatter.hero2.text }}</p>
            <p class="hero-tagline">
              Forms, smart tables and multi-step HTTP flows — declared once in
              <code class="hero-code">.as</code>, rendered everywhere. No render boilerplate, no
              manual wiring, no schema drift.
            </p>
            <div v-if="frontmatter.actions" class="actions">
              <div v-for="action in frontmatter.actions" :key="action.link" class="action">
                <VPButton
                  tag="a"
                  size="medium"
                  :theme="action.theme"
                  :text="action.text"
                  :href="action.link"
                />
              </div>
            </div>
            <div class="hero-pills">
              <span class="hero-pill"><span class="hero-pill-dot"></span>&lt;AsForm /&gt;</span>
              <span class="hero-pill"><span class="hero-pill-dot"></span>&lt;AsTable /&gt;</span>
              <span class="hero-pill"><span class="hero-pill-dot"></span>&lt;AsWfForm /&gt;</span>
            </div>
          </div>
          <div class="hero-image">
            <div class="image-container">
              <div class="image-orbit" aria-hidden="true"></div>
              <div class="image-orbit image-orbit-2" aria-hidden="true"></div>
              <img src="/logo.svg" alt="Atscript UI" class="image-src" />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════ 1. Schema → Form ═══════════════════ -->
      <section class="section-story bg-diagonal">
        <div class="section-inner">
          <div class="showcase animate-in">
            <div class="showcase-head">
              <span class="story-eyebrow">01 · Forms</span>
              <h2 class="section-heading section-heading-center">Forms that write themselves.</h2>
              <p class="story-desc story-desc-center">
                Labels, placeholders, field types and validation live on the model. Mount
                <code>&lt;AsForm&gt;</code> and you get a fully wired form — submit handler,
                per-field errors, structured arrays, nested objects.
              </p>
              <div class="story-tags story-tags-center">
                <span class="story-tag">@meta.label</span>
                <span class="story-tag">@meta.required</span>
                <span class="story-tag">@ui.placeholder</span>
                <span class="story-tag">@expect.*</span>
                <span class="story-tag">&lt;AsForm&gt;</span>
              </div>
              <div class="story-links story-links-center">
                <a href="/guide/quick-start" class="story-link">Quick Start</a>
                <a href="/forms/" class="story-link">Forms Overview</a>
              </div>
            </div>
            <div class="showcase-body">
              <div class="showcase-cell showcase-cell-code">
                <div class="code-label brand-label">contact.as</div>
                <div class="code-block brand-block">
                  <SnippetForm />
                </div>
              </div>
              <div class="showcase-cell showcase-cell-result">
                <div class="form-mockup">
                  <div class="form-mockup-title">Contact</div>
                  <div class="form-field">
                    <label class="form-label">Name <span class="form-req">*</span></label>
                    <input class="form-input" type="text" placeholder="Jane Doe" disabled />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Email</label>
                    <input class="form-input" type="text" placeholder="jane@example.com" disabled />
                  </div>
                  <div class="form-field">
                    <label class="form-label">Message</label>
                    <textarea
                      class="form-textarea"
                      placeholder="Type your message..."
                      disabled
                    ></textarea>
                  </div>
                  <button class="form-btn" disabled>Send</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════════════ 2. Schema → Table ═══════════════════ -->
      <section class="section-story">
        <div class="section-inner">
          <div class="showcase animate-in">
            <div class="showcase-head">
              <span class="story-eyebrow">02 · Tables</span>
              <h2 class="section-heading section-heading-center">
                Tables that filter, sort, paginate, scale.
              </h2>
              <p class="story-desc story-desc-center">
                Server-driven queries, full-text search, sorting, pagination, virtualised scrolling,
                column resize and reorder — wired up automatically from the same annotated type your
                DB uses.
              </p>
              <div class="story-tags story-tags-center">
                <span class="story-tag">@ui.table.*</span>
                <span class="story-tag">@db.index.fulltext</span>
                <span class="story-tag">@ui.dict.*</span>
                <span class="story-tag">&lt;AsTable&gt;</span>
                <span class="story-tag">&lt;AsWindowTable&gt;</span>
              </div>
              <div class="story-links story-links-center">
                <a href="/tables/" class="story-link">Tables Overview</a>
                <a href="/tables/query-function" class="story-link">Query Function</a>
              </div>
            </div>
            <div class="showcase-body showcase-body-table">
              <div class="showcase-cell showcase-cell-code">
                <div class="code-block brand-block code-block-rounded">
                  <SnippetTable />
                </div>
              </div>
              <div class="showcase-cell showcase-cell-result">
                <div class="table-mockup">
                  <div class="table-mockup-toolbar">
                    <div class="table-search">
                      <svg
                        class="table-search-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                      </svg>
                      <span class="table-search-placeholder">Search products…</span>
                    </div>
                    <div class="filter-field">
                      <span class="filter-field-label">Status</span>
                      <div class="filter-field-body">
                        <span class="filter-chip">
                          active
                          <span class="filter-chip-x" aria-hidden="true">×</span>
                        </span>
                      </div>
                      <button class="filter-field-help" aria-label="Value help" tabindex="-1">
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path
                            d="M13 11V12H6V11H13ZM14 10V3C14 2.44772 13.5523 2 13 2H6C5.44772 2 5 2.44772 5 3V10C5 10.5523 5.44772 11 6 11V12C4.96435 12 4.113 11.2128 4.01074 10.2041L4 10V3C4 1.89543 4.89543 1 6 1H13L13.2041 1.01074C14.2128 1.113 15 1.96435 15 3V10L14.9893 10.2041C14.8938 11.1457 14.1457 11.8938 13.2041 11.9893L13 12V11C13.5523 11 14 10.5523 14 10Z"
                            fill="currentColor"
                          />
                          <path d="M11 13V14H4V13H11Z" fill="currentColor" />
                          <path
                            d="M11 13V14L11.2041 13.9893C11.8579 13.923 12.4185 13.542 12.732 13H11Z"
                            fill="currentColor"
                          />
                          <path
                            d="M4 14V13C3.44772 13 3 12.5523 3 12V5V3.26756C2.4022 3.61337 2 4.25972 2 5V12L2.01074 12.2041C2.113 13.2128 2.96435 14 4 14Z"
                            fill="currentColor"
                          />
                          <path d="M14 4V5H4V4H14Z" fill="currentColor" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <table class="table-mockup-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th class="num">Price <span class="sort-active">↓</span></th>
                        <th>Status</th>
                        <th class="num">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Mechanical keyboard</td>
                        <td class="num">$129.00</td>
                        <td><span class="badge badge-ok">active</span></td>
                        <td class="num muted">2d ago</td>
                      </tr>
                      <tr>
                        <td>Trackball mouse</td>
                        <td class="num">$59.99</td>
                        <td><span class="badge badge-ok">active</span></td>
                        <td class="num muted">3d ago</td>
                      </tr>
                      <tr>
                        <td>Aluminium stand</td>
                        <td class="num">$42.00</td>
                        <td><span class="badge badge-ok">active</span></td>
                        <td class="num muted">2w ago</td>
                      </tr>
                      <tr>
                        <td>Braided USB-C cable</td>
                        <td class="num">$14.50</td>
                        <td><span class="badge badge-warn">draft</span></td>
                        <td class="num muted">1w ago</td>
                      </tr>
                    </tbody>
                  </table>
                  <div class="table-mockup-footer">
                    <span>1–20 of 1,243</span>
                    <span class="pager">
                      <span class="pager-btn pager-btn-active">1</span>
                      <span class="pager-btn">2</span>
                      <span class="pager-btn">3</span>
                      <span class="pager-ellipsis">…</span>
                      <span class="pager-btn">62</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════════════ 3. Schema → Workflow ═══════════════════ -->
      <section class="section-story bg-diagonal">
        <div class="section-inner">
          <div class="showcase animate-in">
            <div class="showcase-head">
              <span class="story-eyebrow">03 · Workflows</span>
              <h2 class="section-heading section-heading-center">
                Multi-step flows the server owns.
              </h2>
              <p class="story-desc story-desc-center">
                Login + MFA. Sign-up + verify. Invite + register. Long, branching journeys over
                plain HTTP — the <em>server</em> decides what comes next, the client just renders
                whatever it gets back.
              </p>
              <div class="story-tags story-tags-center">
                <span class="story-tag">@Workflow</span>
                <span class="story-tag">@Step</span>
                <span class="story-tag">requireInput</span>
                <span class="story-tag">&lt;AsWfForm&gt;</span>
                <span class="story-tag">moost-wf</span>
              </div>
              <div class="story-links story-links-center">
                <a href="/workflows/" class="story-link">Workflows Overview</a>
                <a href="/workflows/hello-world" class="story-link">Hello World</a>
              </div>
            </div>
            <div class="showcase-body">
              <div class="showcase-cell showcase-cell-code">
                <div class="code-block brand-block code-block-rounded">
                  <SnippetWorkflow />
                </div>
              </div>
              <div class="showcase-cell showcase-cell-result">
                <div class="wf-stepper">
                  <div class="wf-stepper-row">
                    <div class="wf-step wf-step-done">
                      <span class="wf-step-dot">✓</span>
                      <span class="wf-step-label">Credentials</span>
                    </div>
                    <span class="wf-step-line wf-step-line-done"></span>
                    <div class="wf-step wf-step-active">
                      <span class="wf-step-dot">2</span>
                      <span class="wf-step-label">MFA code</span>
                    </div>
                    <span class="wf-step-line"></span>
                    <div class="wf-step">
                      <span class="wf-step-dot">3</span>
                      <span class="wf-step-label">Dashboard</span>
                    </div>
                  </div>
                  <div class="wf-server-note">
                    <span class="wf-server-arrow">↶</span>
                    server decides next
                  </div>
                  <div class="wf-screen">
                    <div class="wf-screen-title">Step 2 · Verify</div>
                    <div class="form-field">
                      <label class="form-label">6-digit code</label>
                      <input class="form-input" type="text" placeholder="• • • • • •" disabled />
                    </div>
                    <button class="form-btn" disabled>Continue</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════════════ 4. One theme. Every screen. ═══════════════════ -->
      <section class="section-story">
        <div class="section-inner">
          <div class="theme-block animate-in">
            <div class="theme-head">
              <span class="story-eyebrow">04 · Theme</span>
              <h2 class="section-heading section-heading-center">One theme. Every pixel.</h2>
              <p class="story-desc story-desc-center">
                Override <strong>vunor</strong>'s palette, radius, fingertip heights, or icons once
                — every form input, table cell, dialog and step indicator inherits it. No
                per-component restyles.
              </p>
            </div>

            <div class="theme-row">
              <div class="theme-swatches">
                <div class="theme-swatch" style="--sw: #471aec">
                  <span class="swatch-tag">primary</span>
                </div>
                <div class="theme-swatch" style="--sw: #18a674">
                  <span class="swatch-tag">success</span>
                </div>
                <div class="theme-swatch" style="--sw: #d97706">
                  <span class="swatch-tag">warning</span>
                </div>
                <div class="theme-swatch" style="--sw: #dc2626">
                  <span class="swatch-tag">danger</span>
                </div>
                <div class="theme-swatch theme-swatch-neutral">
                  <span class="swatch-tag">neutral</span>
                </div>
              </div>

              <div class="theme-knobs">
                <div class="knob-row">
                  <span class="knob-label">radius</span>
                  <span class="knob-track">
                    <span class="knob-dot knob-dot-active"></span>
                    <span class="knob-dot"></span>
                    <span class="knob-dot"></span>
                  </span>
                  <span class="knob-hint">4 · 8 · 14</span>
                </div>
                <div class="knob-row">
                  <span class="knob-label">fingertip</span>
                  <span class="knob-track">
                    <span class="knob-dot"></span>
                    <span class="knob-dot knob-dot-active"></span>
                    <span class="knob-dot"></span>
                  </span>
                  <span class="knob-hint">xs · s · m</span>
                </div>
                <div class="knob-buttons">
                  <span class="theme-btn theme-btn-filled">Save</span>
                  <span class="theme-btn theme-btn-outlined">Cancel</span>
                  <span class="theme-btn theme-btn-ghost">More</span>
                </div>
              </div>
            </div>

            <div class="story-links" style="justify-content: center; margin-top: 28px">
              <a href="/styling/theme" class="story-link">Theme &amp; Palette</a>
              <a href="/styling/icons" class="story-link">Icons</a>
              <a href="/styling/shortcuts" class="story-link">as-* Shortcuts</a>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════════════ 5. AI Skills ═══════════════════ -->
      <section class="section-skill">
        <div class="section-inner">
          <div class="skill-block animate-in">
            <div class="skill-head">
              <span class="story-eyebrow">05 · AI agent skill</span>
              <h2 class="section-heading section-heading-center">Your AI already speaks it.</h2>
              <p class="story-desc story-desc-center skill-desc">
                One command teaches Claude Code, Cursor, Windsurf, and Codex the entire UI stack —
                <code>&lt;AsForm&gt;</code>, <code>&lt;AsTable&gt;</code>,
                <code>&lt;AsWfForm&gt;</code>, theming, and the framework-agnostic core.
              </p>
            </div>

            <button
              type="button"
              class="install-card"
              :class="{ copied: copiedCmd === 'npx skills add moostjs/atscript-ui' }"
              @click="copyCmd('npx skills add moostjs/atscript-ui')"
              aria-label="Copy install command: npx skills add moostjs/atscript-ui"
            >
              <span class="install-prompt">$</span>
              <span class="install-cmd">npx skills add <strong>moostjs/atscript-ui</strong></span>
              <span class="install-action" aria-hidden="true">
                <span class="install-action-icon">
                  <svg
                    v-if="copiedCmd !== 'npx skills add moostjs/atscript-ui'"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                  <svg
                    v-else
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span class="install-action-label">
                  {{
                    copiedCmd === "npx skills add moostjs/atscript-ui" ? "Copied!" : "Click to copy"
                  }}
                </span>
              </span>
            </button>

            <ul class="install-bullets">
              <li>
                <span class="bullet-dot"></span><code>@ui.*</code> annotations &amp; field resolver
              </li>
              <li>
                <span class="bullet-dot"></span><code>&lt;AsForm&gt;</code> ·
                <code>&lt;AsTable&gt;</code> · <code>&lt;AsWfForm&gt;</code>
              </li>
              <li>
                <span class="bullet-dot"></span><code>moost-wf</code> server workflows &amp; presets
              </li>
              <li><span class="bullet-dot"></span>UnoCSS preset, vunor theming, icons</li>
            </ul>

            <div class="skill-companions">
              <span class="companions-label">Companions</span>
              <div class="companions-list">
                <button
                  type="button"
                  class="companions-pill"
                  :class="{ copied: copiedCmd === 'npx skills add moostjs/atscript' }"
                  @click="copyCmd('npx skills add moostjs/atscript')"
                  aria-label="Copy: npx skills add moostjs/atscript"
                >
                  <span class="pill-tag">DSL</span>
                  <code>npx skills add moostjs/atscript</code>
                  <span class="pill-icon" aria-hidden="true">
                    <svg
                      v-if="copiedCmd !== 'npx skills add moostjs/atscript'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                </button>
                <button
                  type="button"
                  class="companions-pill"
                  :class="{ copied: copiedCmd === 'npx skills add moostjs/atscript-db' }"
                  @click="copyCmd('npx skills add moostjs/atscript-db')"
                  aria-label="Copy: npx skills add moostjs/atscript-db"
                >
                  <span class="pill-tag">DATA</span>
                  <code>npx skills add moostjs/atscript-db</code>
                  <span class="pill-icon" aria-hidden="true">
                    <svg
                      v-if="copiedCmd !== 'npx skills add moostjs/atscript-db'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>

            <a href="https://skills.sh" class="story-link skill-link"
              >Learn about AI agent skills</a
            >
          </div>
        </div>
      </section>

      <!-- ═══════════════════ 6. Part of the stack ═══════════════════ -->
      <section class="section-adapters">
        <div class="section-inner">
          <div class="stack-block animate-in">
            <h2 class="section-heading section-heading-center">Part of a model-driven stack.</h2>
            <p class="story-desc story-desc-center">
              One <code>.as</code> file powers TypeScript types, runtime validation, DB schema, REST
              routes, forms and tables. Three sites, one source of truth.
            </p>
            <div class="stack-grid">
              <a href="https://atscript.dev" class="stack-card">
                <div class="stack-card-tag">DSL</div>
                <div class="stack-card-name">Atscript</div>
                <div class="stack-card-note">
                  Types, metadata and validation from a single <code>.as</code> model.
                </div>
                <span class="stack-card-host">atscript.dev →</span>
              </a>
              <a href="https://db.atscript.dev" class="stack-card">
                <div class="stack-card-tag">data</div>
                <div class="stack-card-name">Atscript DB</div>
                <div class="stack-card-note">
                  Tables, relations, views, sync and REST — all from <code>.as</code>.
                </div>
                <span class="stack-card-host">db.atscript.dev →</span>
              </a>
              <a href="https://moost.org" class="stack-card">
                <div class="stack-card-tag">runtime</div>
                <div class="stack-card-name">Moost</div>
                <div class="stack-card-note">
                  The decorator-driven framework for HTTP, CLI, WF and WS events.
                </div>
                <span class="stack-card-host">moost.org →</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </template>
  </Layout>
</template>

<style scoped>
/* ════════════════════ Layout ════════════════════ */
.section-inner {
  max-width: 1152px;
  margin: 0 auto;
}
.section-heading {
  font-size: 28px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 0 0 16px;
  letter-spacing: -0.5px;
  line-height: 1.2;
}
@media (min-width: 640px) {
  .section-heading {
    font-size: 34px;
  }
}
.section-heading-center {
  text-align: center;
}
.story-eyebrow {
  display: inline-block;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
  background: rgba(71, 26, 236, 0.08);
  padding: 4px 10px;
  border-radius: 999px;
  margin-bottom: 14px;
}
:global(.dark) .story-eyebrow {
  background: rgba(174, 153, 252, 0.12);
}
.bg-diagonal {
  position: relative;
}
.bg-diagonal::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--vp-c-bg-soft);
  clip-path: polygon(0 40px, 100% 0, 100% 100%, 0 calc(100% - 40px));
}
/* ════════════════════ Hero ════════════════════ */
.custom-hero {
  position: relative;
  overflow: hidden;
  margin-top: calc((var(--vp-nav-height) + var(--vp-layout-top-height, 0px)) * -1);
  padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 48px) 24px 48px;
}
@media (min-width: 640px) {
  .custom-hero {
    padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 64px) 48px 64px;
  }
}
@media (min-width: 960px) {
  .custom-hero {
    padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 72px) 64px 72px;
  }
}
.hero-grid-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(rgba(71, 26, 236, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(71, 26, 236, 0.06) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse at 50% 0%, rgba(0, 0, 0, 0.7), transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 0%, rgba(0, 0, 0, 0.7), transparent 70%);
  pointer-events: none;
}
:global(.dark) .hero-grid-bg {
  background-image:
    linear-gradient(rgba(174, 153, 252, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(174, 153, 252, 0.08) 1px, transparent 1px);
}
.hero-inner {
  position: relative;
  z-index: 1;
  max-width: 1152px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
@media (min-width: 960px) {
  .hero-inner {
    flex-direction: row;
    text-align: left;
  }
}
.hero-main {
  position: relative;
  z-index: 10;
  order: 2;
  flex-grow: 1;
  flex-shrink: 0;
}
@media (min-width: 960px) {
  .hero-main {
    order: 1;
    width: calc((100% / 3) * 2);
    max-width: 592px;
  }
}
.hero-image {
  order: 1;
  margin: -76px -24px -48px;
}
@media (min-width: 640px) {
  .hero-image {
    margin: -108px -24px -48px;
  }
}
@media (min-width: 960px) {
  .hero-image {
    flex-grow: 1;
    order: 2;
    margin: 0;
    min-height: 100%;
  }
}
.image-container {
  position: relative;
  margin: 0 auto;
  width: 320px;
  height: 320px;
}
@media (min-width: 640px) {
  .image-container {
    width: 392px;
    height: 392px;
  }
}
@media (min-width: 960px) {
  .image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    transform: translate(-32px, -32px);
  }
}
.image-orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  border: 1px dashed rgba(71, 26, 236, 0.25);
  transform: translate(-50%, -50%);
  animation: orbit-spin 60s linear infinite;
}
.image-orbit-2 {
  width: 380px;
  height: 380px;
  border-color: rgba(71, 26, 236, 0.15);
  animation: orbit-spin 120s linear infinite reverse;
}
:global(.dark) .image-orbit {
  border-color: rgba(174, 153, 252, 0.25);
}
:global(.dark) .image-orbit-2 {
  border-color: rgba(174, 153, 252, 0.15);
}
@keyframes orbit-spin {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
.image-src {
  position: absolute;
  top: 50%;
  left: 50%;
  max-width: 192px;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 0 40px rgba(71, 26, 236, 0.35))
    drop-shadow(0 0 80px rgba(71, 26, 236, 0.25)) drop-shadow(0 0 120px rgba(71, 26, 236, 0.15));
}
:global(.dark) .image-src {
  filter: drop-shadow(0 0 40px rgba(174, 153, 252, 0.5))
    drop-shadow(0 0 80px rgba(174, 153, 252, 0.35)) drop-shadow(0 0 140px rgba(174, 153, 252, 0.2));
}
@media (min-width: 640px) {
  .image-src {
    max-width: 256px;
  }
}
@media (min-width: 960px) {
  .image-src {
    max-width: 320px;
  }
}
.hero-kicker {
  margin: 0 0 12px;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.kicker-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.kicker-link:hover {
  text-decoration-thickness: 2px;
}
.hero-name {
  font-size: 56px;
  font-weight: 600;
  letter-spacing: -1.5px;
  line-height: 1.05;
  color: var(--vp-c-brand-1);
  margin: 0 0 12px;
  background: linear-gradient(135deg, var(--vp-c-brand-1) 0%, var(--vp-c-brand-2) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
@media (min-width: 640px) {
  .hero-name {
    font-size: 72px;
  }
}
@media (min-width: 960px) {
  .hero-name {
    font-size: 88px;
  }
}
.hero-text {
  font-size: 22px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  line-height: 1.25;
  max-width: 600px;
  margin: 0 auto 12px;
  letter-spacing: -0.5px;
}
@media (min-width: 640px) {
  .hero-text {
    font-size: 32px;
  }
}
@media (min-width: 960px) {
  .hero-text {
    font-size: 38px;
    margin: 0 0 12px;
  }
}
.hero-tagline {
  font-size: 16px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  max-width: 540px;
  margin: 0 auto;
  line-height: 1.55;
}
.hero-code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.9em;
  background: rgba(71, 26, 236, 0.1);
  color: var(--vp-c-brand-1);
  padding: 1px 6px;
  border-radius: 4px;
}
:global(.dark) .hero-code {
  background: rgba(174, 153, 252, 0.15);
}
@media (min-width: 640px) {
  .hero-tagline {
    font-size: 18px;
  }
}
@media (min-width: 960px) {
  .hero-tagline {
    margin: 0;
  }
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin: -6px;
  padding-top: 28px;
}
@media (min-width: 960px) {
  .actions {
    justify-content: flex-start;
  }
}
.action {
  flex-shrink: 0;
  padding: 6px;
}
.hero-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
  justify-content: center;
}
@media (min-width: 960px) {
  .hero-pills {
    justify-content: flex-start;
  }
}
.hero-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  letter-spacing: -0.2px;
}
:global(.dark) .hero-pill {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.08);
}
.hero-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  box-shadow: 0 0 8px rgba(71, 26, 236, 0.6);
}
:global(.dark) .hero-pill-dot {
  box-shadow: 0 0 8px rgba(174, 153, 252, 0.6);
}

/* ════════════════════ Story Sections ════════════════════ */
.section-story {
  padding: 64px 24px;
}
@media (min-width: 640px) {
  .section-story {
    padding: 80px 48px;
  }
}
@media (min-width: 960px) {
  .section-story {
    padding: 96px 64px;
  }
}

.showcase {
  display: flex;
  flex-direction: column;
  gap: 48px;
}
.showcase-head {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
}
.showcase-body {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  align-items: stretch;
}
@media (min-width: 900px) {
  .showcase-body {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
  }
}
@media (min-width: 900px) {
  .showcase-body-table {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  }
}
.showcase-cell {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.story-desc {
  max-width: 540px;
  margin: 0 0 18px;
  font-size: 16px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.story-desc-center {
  margin-left: auto;
  margin-right: auto;
  text-align: center;
}
.story-desc-link {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 600;
  border-bottom: 1px dashed currentColor;
}
.story-desc-link:hover {
  border-bottom-style: solid;
}
.story-desc code {
  font-size: 14px;
  color: var(--vp-c-brand-1);
  background: rgba(71, 26, 236, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: var(--vp-font-family-mono);
}
:global(.dark) .story-desc code {
  background: rgba(174, 153, 252, 0.12);
}

.story-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 22px;
}
.story-tags-center {
  justify-content: center;
}
.story-tag {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(71, 26, 236, 0.08);
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
}
:global(.dark) .story-tag {
  background: rgba(174, 153, 252, 0.12);
}

.story-links {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 14px;
}
.story-links-center {
  justify-content: center;
}
.story-link {
  display: inline-flex;
  align-items: center;
  color: var(--vp-c-brand-1);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.story-link::after {
  content: "→";
  margin-left: 6px;
  font-size: 14px;
  transition: transform 0.2s ease;
}
.story-link:hover {
  text-decoration: underline;
}
.story-link:hover::after {
  transform: translateX(2px);
}

.story-code {
  min-width: 0;
}

/* ════════════════════ Code Blocks ════════════════════ */
.code-label {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
  border-radius: 12px 12px 0 0;
}
.brand-label {
  background: rgba(71, 26, 236, 0.12);
  color: var(--vp-c-brand-1);
}
:global(.dark) .brand-label {
  background: rgba(174, 153, 252, 0.12);
}
.code-block {
  border-radius: 0 0 12px 12px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-top: none;
  background: var(--vp-c-bg);
}
.code-block-rounded {
  border-radius: 12px;
  border-top: 1px solid var(--vp-c-divider);
}
:global(.dark) .code-block {
  border-color: rgba(255, 255, 255, 0.06);
}
.brand-block {
  box-shadow:
    0 0 40px rgba(71, 26, 236, 0.1),
    0 0 80px rgba(71, 26, 236, 0.05);
  border-color: rgba(71, 26, 236, 0.2);
}
:global(.dark) .brand-block {
  box-shadow:
    0 0 40px rgba(174, 153, 252, 0.15),
    0 0 80px rgba(174, 153, 252, 0.08);
  border-color: rgba(174, 153, 252, 0.25);
}
.code-block :deep(div[class*="language-"]) {
  margin: 0 !important;
  border-radius: 0;
  background: var(--vp-c-bg) !important;
}
.code-block :deep(button.copy),
.code-block :deep(span.lang),
.code-block :deep(.line-numbers-wrapper) {
  display: none !important;
}
.code-block :deep(pre) {
  padding: 0 !important;
  margin: 0 !important;
  overflow-x: auto;
}
.code-block :deep(code) {
  display: block;
  width: fit-content;
  min-width: 100%;
  padding: 8px 20px;
  font-size: 13px;
}
.code-block :deep(.file-sep) {
  padding: 4px 16px;
  font-size: 12px;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-alt);
  border-top: 1px solid var(--vp-c-divider);
}
:global(.dark) .code-block :deep(.file-sep) {
  border-top-color: rgba(255, 255, 255, 0.06);
}
.code-block :deep(.file-sep:first-child) {
  border-top: none;
}

/* ════════════════════ Section 1 — Form Mockup ════════════════════ */
.form-mockup {
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  padding: 22px;
  box-shadow:
    0 0 40px rgba(71, 26, 236, 0.1),
    0 0 80px rgba(71, 26, 236, 0.05);
}
:global(.dark) .form-mockup {
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow:
    0 0 40px rgba(174, 153, 252, 0.15),
    0 0 80px rgba(174, 153, 252, 0.08);
}
.form-mockup-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 20px;
}
.form-field {
  margin-bottom: 14px;
}
.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.form-req {
  color: #e53e3e;
}
.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-3);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
.form-textarea {
  min-height: 60px;
  resize: none;
}
.form-btn {
  margin-top: 4px;
  padding: 8px 24px;
  border-radius: 8px;
  border: none;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: default;
}

/* ════════════════════ Section 2 — Table Mockup ════════════════════ */
.table-mockup {
  margin-top: 16px;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  overflow: hidden;
  box-shadow:
    0 0 40px rgba(71, 26, 236, 0.1),
    0 0 80px rgba(71, 26, 236, 0.05);
}
:global(.dark) .table-mockup {
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow:
    0 0 40px rgba(174, 153, 252, 0.15),
    0 0 80px rgba(174, 153, 252, 0.08);
}
.table-mockup-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}
:global(.dark) .table-mockup-toolbar {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.table-search {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  flex: 1;
  min-width: 0;
  max-width: 240px;
}
:global(.dark) .table-search {
  border-color: rgba(255, 255, 255, 0.08);
}
.table-search-icon {
  width: 18px;
  height: 18px;
  color: var(--vp-c-text-2);
  flex-shrink: 0;
}
.table-search-placeholder {
  font-size: 13px;
  color: var(--vp-c-text-3);
}
.filter-field {
  display: inline-flex;
  align-items: stretch;
  height: 32px;
  border-radius: 6px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  min-width: 0;
  max-width: 280px;
  flex: 1;
  overflow: hidden;
}
:global(.dark) .filter-field {
  border-color: rgba(255, 255, 255, 0.08);
}
.filter-field-label {
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  background: rgba(0, 0, 0, 0.025);
  border-right: 1px solid var(--vp-c-divider);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}
:global(.dark) .filter-field-label {
  background: rgba(255, 255, 255, 0.04);
  border-right-color: rgba(255, 255, 255, 0.08);
}
.filter-field-body {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  flex: 1;
  min-width: 0;
  background: var(--vp-c-bg);
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 4px 0 8px;
  border-radius: 4px;
  background: rgba(71, 26, 236, 0.08);
  border: 1px solid rgba(71, 26, 236, 0.35);
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
:global(.dark) .filter-chip {
  background: rgba(174, 153, 252, 0.12);
  border-color: rgba(174, 153, 252, 0.4);
}
.filter-chip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  opacity: 0.6;
  font-size: 14px;
  line-height: 1;
}
.filter-field-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  border: none;
  border-left: 1px solid var(--vp-c-divider);
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: default;
  flex-shrink: 0;
  padding: 0;
}
:global(.dark) .filter-field-help {
  border-left-color: rgba(255, 255, 255, 0.08);
}
.filter-field-help:hover {
  background: rgba(0, 0, 0, 0.03);
  color: var(--vp-c-brand-1);
}
:global(.dark) .filter-field-help:hover {
  background: rgba(255, 255, 255, 0.04);
}
.filter-field-help svg {
  width: 16px;
  height: 16px;
}
.table-mockup-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table-mockup-table th {
  text-align: left;
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-2);
  padding: 10px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}
:global(.dark) .table-mockup-table th {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.table-mockup-table th.num,
.table-mockup-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-family: var(--vp-font-family-mono);
}
.table-mockup-table td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}
:global(.dark) .table-mockup-table td {
  border-bottom-color: rgba(255, 255, 255, 0.04);
}
.table-mockup-table tr:last-child td {
  border-bottom: none;
}
.table-mockup-table tr:hover td {
  background: rgba(71, 26, 236, 0.04);
}
:global(.dark) .table-mockup-table tr:hover td {
  background: rgba(174, 153, 252, 0.05);
}
.muted {
  color: var(--vp-c-text-3);
}
.sort-active {
  color: var(--vp-c-brand-1);
  margin-left: 4px;
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--vp-font-family-mono);
  letter-spacing: 0.02em;
}
.badge-ok {
  background: rgba(24, 166, 116, 0.15);
  color: #18a674;
}
.badge-warn {
  background: rgba(217, 119, 6, 0.15);
  color: #d97706;
}
.table-mockup-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 12px;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-alt);
  border-top: 1px solid var(--vp-c-divider);
}
:global(.dark) .table-mockup-footer {
  border-top-color: rgba(255, 255, 255, 0.06);
}
.pager {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pager-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--vp-c-text-2);
  border: 1px solid transparent;
}
.pager-btn-active {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.pager-ellipsis {
  color: var(--vp-c-text-3);
  padding: 0 2px;
}

/* ════════════════════ Section 3 — Workflow Stepper ════════════════════ */
.wf-stepper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px 22px 26px;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  box-shadow:
    0 0 40px rgba(71, 26, 236, 0.1),
    0 0 80px rgba(71, 26, 236, 0.05);
}
:global(.dark) .wf-stepper {
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow:
    0 0 40px rgba(174, 153, 252, 0.15),
    0 0 80px rgba(174, 153, 252, 0.08);
}
.wf-stepper-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0;
}
.wf-screen {
  margin-top: 16px;
  padding: 18px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}
:global(.dark) .wf-screen {
  border-color: rgba(255, 255, 255, 0.06);
}
.wf-screen-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  margin-bottom: 14px;
  letter-spacing: -0.2px;
}
.wf-screen .form-field {
  margin-bottom: 14px;
}
.wf-step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 1;
}
.wf-step-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  font-weight: 700;
  background: var(--vp-c-bg-alt);
  border: 2px solid var(--vp-c-divider);
  color: var(--vp-c-text-3);
  transition:
    background 0.2s ease,
    transform 0.2s ease;
}
.wf-step-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.wf-step-done .wf-step-dot {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
}
.wf-step-done .wf-step-label {
  color: var(--vp-c-text-1);
}
.wf-step-active .wf-step-dot {
  background: var(--vp-c-bg);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 4px rgba(71, 26, 236, 0.15);
  transform: scale(1.08);
}
:global(.dark) .wf-step-active .wf-step-dot {
  box-shadow: 0 0 0 4px rgba(174, 153, 252, 0.2);
}
.wf-step-active .wf-step-label {
  color: var(--vp-c-brand-1);
  font-weight: 700;
}
.wf-step-line {
  flex: 1;
  height: 2px;
  background: var(--vp-c-divider);
  margin: 0 -6px 28px;
  position: relative;
  z-index: 0;
}
.wf-step-line-done {
  background: var(--vp-c-brand-1);
}
.wf-server-note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: center;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-text-3);
  letter-spacing: 0.02em;
}
.wf-server-arrow {
  color: var(--vp-c-brand-1);
  font-size: 14px;
}

/* ════════════════════ Section 4 — Theme ════════════════════ */
.theme-block {
  max-width: 920px;
  margin: 0 auto;
}
.theme-head {
  text-align: center;
  margin-bottom: 36px;
}
.theme-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  align-items: center;
}
@media (min-width: 720px) {
  .theme-row {
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
}
.theme-swatches {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.theme-swatch {
  position: relative;
  aspect-ratio: 1;
  border-radius: 14px;
  background: var(--sw, #888);
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  padding: 8px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition: transform 0.25s ease;
}
.theme-swatch:hover {
  transform: translateY(-2px);
}
.theme-swatch-neutral {
  background: linear-gradient(135deg, #2a2438, #4a4458);
}
:global(.dark) .theme-swatch-neutral {
  background: linear-gradient(135deg, #d4d0e0, #a8a4b8);
}
.swatch-tag {
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.04em;
}
.theme-knobs {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}
:global(.dark) .theme-knobs {
  border-color: rgba(255, 255, 255, 0.06);
}
.knob-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.knob-label {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
  min-width: 72px;
}
.knob-track {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  height: 2px;
  background: var(--vp-c-divider);
  position: relative;
  padding: 0 2px;
}
.knob-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--vp-c-bg-alt);
  border: 2px solid var(--vp-c-divider);
  position: relative;
  z-index: 1;
}
.knob-dot-active {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 4px rgba(71, 26, 236, 0.15);
}
:global(.dark) .knob-dot-active {
  box-shadow: 0 0 0 4px rgba(174, 153, 252, 0.2);
}
.knob-hint {
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  color: var(--vp-c-text-3);
}
.knob-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 10px;
  margin-top: 4px;
  border-top: 1px dashed var(--vp-c-divider);
}
:global(.dark) .knob-buttons {
  border-top-color: rgba(255, 255, 255, 0.06);
}
.theme-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
}
.theme-btn-filled {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.theme-btn-outlined {
  border: 1px solid var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.theme-btn-ghost {
  color: var(--vp-c-brand-1);
}

/* ════════════════════ Section 5 — AI Agent Skill ════════════════════ */
.section-skill {
  position: relative;
  padding: 56px 24px 64px;
  background:
    radial-gradient(
      ellipse at 50% 0%,
      color-mix(in srgb, var(--vp-c-brand-1) 8%, transparent),
      transparent 60%
    ),
    var(--vp-c-bg);
}
:global(.dark) .section-skill {
  background:
    radial-gradient(
      ellipse at 50% 0%,
      color-mix(in srgb, var(--vp-c-brand-1) 14%, transparent),
      transparent 65%
    ),
    var(--vp-c-bg);
}
@media (min-width: 640px) {
  .section-skill {
    padding: 72px 48px 80px;
  }
}
@media (min-width: 960px) {
  .section-skill {
    padding: 80px 64px 88px;
  }
}
.skill-block {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.skill-head {
  text-align: center;
  margin-bottom: 28px;
}
.skill-desc {
  margin-bottom: 0;
}
.skill-desc code {
  font-size: 13px;
  color: var(--vp-c-brand-1);
  background: rgba(71, 26, 236, 0.08);
  padding: 1px 6px;
  border-radius: 5px;
  font-family: var(--vp-font-family-mono);
}
:global(.dark) .skill-desc code {
  background: rgba(174, 153, 252, 0.14);
}

/* Install card */
.install-card {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 520px;
  padding: 12px 12px 12px 18px;
  border-radius: 12px;
  border: 1px solid rgba(71, 26, 236, 0.28);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  cursor: pointer;
  text-align: left;
  box-shadow:
    0 12px 32px rgba(71, 26, 236, 0.12),
    0 0 0 4px rgba(71, 26, 236, 0.05);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}
:global(.dark) .install-card {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(174, 153, 252, 0.32);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.4),
    0 0 0 4px rgba(174, 153, 252, 0.06);
}
.install-card:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-1);
  box-shadow:
    0 18px 40px rgba(71, 26, 236, 0.18),
    0 0 0 4px rgba(71, 26, 236, 0.08);
}
.install-card.copied {
  border-color: #18a674;
  box-shadow:
    0 12px 32px rgba(24, 166, 116, 0.18),
    0 0 0 4px rgba(24, 166, 116, 0.08);
}
.install-prompt {
  font-size: 17px;
  font-weight: 800;
  color: var(--vp-c-brand-1);
  line-height: 1;
}
.install-cmd {
  flex: 1;
  font-size: 14px;
  letter-spacing: -0.1px;
  color: var(--vp-c-text-1);
  overflow-x: auto;
  white-space: nowrap;
}
.install-cmd strong {
  color: var(--vp-c-brand-1);
  font-weight: 700;
}
@media (min-width: 640px) {
  .install-cmd {
    font-size: 15px;
  }
}
.install-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 6px 8px;
  border-radius: 999px;
  background: rgba(71, 26, 236, 0.08);
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-sans);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}
:global(.dark) .install-action {
  background: rgba(174, 153, 252, 0.14);
}
.install-card.copied .install-action {
  background: rgba(24, 166, 116, 0.12);
  color: #18a674;
}
.install-action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}
.install-action-icon svg {
  width: 13px;
  height: 13px;
}
@media (max-width: 520px) {
  .install-action-label {
    display: none;
  }
}

/* Install bullets */
.install-bullets {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 22px;
  margin: 18px 0 6px;
  padding: 0;
  list-style: none;
}
.install-bullets li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.install-bullets li code {
  font-size: 12.5px;
  color: var(--vp-c-brand-1);
  background: rgba(71, 26, 236, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: var(--vp-font-family-mono);
}
:global(.dark) .install-bullets li code {
  background: rgba(174, 153, 252, 0.14);
}
.bullet-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  flex-shrink: 0;
  opacity: 0.7;
}

/* Companions */
.skill-companions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 28px 0 8px;
  width: 100%;
}
.companions-label {
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}
.companions-list {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  width: 100%;
}
.companions-pill {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 6px 10px 6px 6px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease,
    transform 0.15s ease;
}
.companions-pill:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
  transform: translateY(-1px);
}
.companions-pill:active {
  transform: translateY(0);
}
.companions-pill.copied {
  border-color: #18a674;
  background: color-mix(in srgb, #18a674 6%, transparent);
}
:global(.dark) .companions-pill {
  border-color: rgba(255, 255, 255, 0.1);
}
.pill-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  background: rgba(71, 26, 236, 0.1);
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
}
:global(.dark) .pill-tag {
  background: rgba(174, 153, 252, 0.18);
}
.companions-pill code {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  background: transparent;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pill-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--vp-c-text-3);
  background: transparent;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}
.pill-icon svg {
  width: 14px;
  height: 14px;
}
.companions-pill:hover .pill-icon {
  color: var(--vp-c-brand-1);
  background: rgba(71, 26, 236, 0.08);
}
.companions-pill.copied .pill-icon {
  color: #18a674;
  background: rgba(24, 166, 116, 0.12);
}
.skill-link {
  margin-top: 18px;
}

/* ════════════════════ Section 6 — Stack ════════════════════ */
.section-adapters {
  padding: 64px 24px 56px;
  margin-bottom: 0;
}
@media (min-width: 640px) {
  .section-adapters {
    padding: 80px 48px 72px;
  }
}
@media (min-width: 960px) {
  .section-adapters {
    padding: 96px 64px 88px;
  }
}
.stack-block {
  max-width: 980px;
  margin: 0 auto;
}
.stack-block .story-desc code {
  font-size: 14px;
}
.stack-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-top: 32px;
}
@media (min-width: 720px) {
  .stack-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
.stack-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 22px 22px 18px;
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  transition:
    border-color 0.25s ease,
    transform 0.25s ease,
    box-shadow 0.25s ease;
}
.stack-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  opacity: 0;
  transition: opacity 0.25s ease;
}
.stack-card:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(71, 26, 236, 0.12);
}
.stack-card:hover::before {
  opacity: 1;
}
:global(.dark) .stack-card:hover {
  box-shadow: 0 8px 28px rgba(174, 153, 252, 0.18);
}
.stack-card-tag {
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}
.stack-card-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  letter-spacing: -0.5px;
  margin-bottom: 2px;
}
.stack-card-note {
  font-size: 14px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
  margin-bottom: 8px;
}
.stack-card-note code {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  background: rgba(71, 26, 236, 0.08);
  color: var(--vp-c-brand-1);
  padding: 1px 5px;
  border-radius: 4px;
}
:global(.dark) .stack-card-note code {
  background: rgba(174, 153, 252, 0.12);
}
.stack-card-host {
  margin-top: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

/* ════════════════════ Scroll Animations ════════════════════ */
.animate-in {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;
}
.animate-in.visible {
  opacity: 1;
  transform: translateY(0);
}
</style>
