import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { nextTick } from "vue";
import HomeLayout from "./HomeLayout.vue";

import "./style.css";

function colorizeAtscriptAnnotations() {
  if (typeof window === "undefined") {
    return;
  }
  const lines = window.document.querySelectorAll(".language-atscript code .line");
  lines.forEach((line: Element) => {
    const spans = line.querySelectorAll("span");
    spans.forEach((span: HTMLElement) => {
      if (span.textContent && span.textContent.trim().startsWith("@")) {
        span.style.color = "#2baac4ff";
        span.style.fontWeight = "600";
      }
    });
  });
}

export default {
  extends: DefaultTheme,
  Layout: HomeLayout,
  enhanceApp({ app: _app }) {
    // Register global mixins for atscript annotation coloring
  },
} satisfies Theme;

// Apply colorization on client side
if (typeof window !== "undefined") {
  const observer = new MutationObserver(() => {
    void nextTick(colorizeAtscriptAnnotations);
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
}
