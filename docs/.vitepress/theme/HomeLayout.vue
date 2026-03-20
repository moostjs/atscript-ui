<script setup>
import { onMounted, nextTick, watch } from "vue";
import { useData, useRoute } from "vitepress";
import DefaultTheme from "vitepress/theme";
import VPButton from "vitepress/dist/client/theme-default/components/VPButton.vue";
import SnippetSchema from "./snippets/snippet-schema.md";

const { Layout } = DefaultTheme;
const { frontmatter } = useData();
const route = useRoute();

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
        <div class="hero-inner">
          <div class="hero-main">
            <p class="hero-kicker">
              UI layer for <a href="https://atscript.dev" class="kicker-link">Atscript</a>
            </p>
            <h1 class="hero-name">Atscript UI</h1>
            <p class="hero-text">{{ frontmatter.hero2.text }}</p>
            <p class="hero-tagline">{{ frontmatter.hero2.tagline }}</p>
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
          </div>
          <div class="hero-image">
            <div class="image-container">
              <img src="/logo.svg" alt="Atscript UI" class="image-src" />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════ 1. Schema → Form ═══════════════════ -->
      <section class="section-story bg-diagonal">
        <div class="section-inner">
          <div class="schema-to-form animate-in">
            <div class="schema-side">
              <div class="code-label brand-label">contact.as</div>
              <div class="code-block brand-block">
                <SnippetSchema />
              </div>
            </div>
            <div class="arrow-separator">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="form-side">
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
                  <textarea class="form-textarea" placeholder="Type your message..." disabled></textarea>
                </div>
                <button class="form-btn" disabled>Send</button>
              </div>
            </div>
          </div>
          <div class="schema-to-form-footer animate-in">
            <p class="story-desc" style="margin-bottom: 0; text-align: center; max-width: 640px; margin-left: auto; margin-right: auto;">
              Define labels, placeholders, field types, and validation in a single
              <code>.as</code> file — the form renders itself.
            </p>
            <div class="story-links" style="justify-content: center;">
              <a href="/guide/quick-start" class="story-link">Quick Start</a>
              <a href="/forms/" class="story-link">Form Overview</a>
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
    padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 64px) 64px 64px;
  }
}
.hero-inner {
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
  font-size: 84px;
  font-weight: 600;
  letter-spacing: -1px;
  line-height: 1.1;
  color: var(--vp-c-brand-1);
  margin-bottom: 8px;
}
@media (min-width: 640px) {
  .hero-name {
    font-size: 56px;
  }
}
@media (min-width: 960px) {
  .hero-name {
    font-size: 84px;
  }
}
.hero-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  line-height: 1.3;
  max-width: 600px;
  margin: 0 auto 8px;
}
@media (min-width: 640px) {
  .hero-text {
    font-size: 32px;
  }
}
@media (min-width: 960px) {
  .hero-text {
    font-size: 36px;
    margin: 0 0 8px;
  }
}
.hero-tagline {
  font-size: 16px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  max-width: 520px;
  margin: 0 auto;
  line-height: 1.5;
}
@media (min-width: 640px) {
  .hero-tagline {
    font-size: 20px;
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

/* ════════════════════ Story Sections ════════════════════ */
.section-story {
  padding: 56px 24px;
}
@media (min-width: 640px) {
  .section-story {
    padding: 72px 48px;
  }
}
@media (min-width: 960px) {
  .section-story {
    padding: 80px 64px;
  }
}

.story-desc {
  max-width: 540px;
  margin: 0 0 18px;
  font-size: 16px;
  line-height: 1.75;
  color: var(--vp-c-text-2);
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

.story-links {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 14px;
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
  content: "->";
  margin-left: 8px;
  font-size: 12px;
}
.story-link:hover {
  text-decoration: underline;
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
/* ════════════════════ Schema → Form ════════════════════ */
.schema-to-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}
@media (min-width: 900px) {
  .schema-to-form {
    grid-template-columns: minmax(0, 1.1fr) auto minmax(0, 1fr);
    gap: 28px;
    align-items: center;
  }
}
.schema-side {
  min-width: 0;
}
.arrow-separator {
  display: none;
  color: var(--vp-c-brand-1);
  opacity: 0.6;
}
@media (min-width: 900px) {
  .arrow-separator {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
.form-side {
  min-width: 0;
}
.schema-to-form-footer {
  margin-top: 28px;
}

/* Form Mockup */
.form-mockup {
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  padding: 24px;
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
  margin-bottom: 16px;
}
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin-bottom: 6px;
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
  min-height: 72px;
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
