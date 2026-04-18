<script setup lang="ts">
import { onMounted, provide, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";

const formRoutes = [
  { path: "/", label: "Home" },
  { path: "/basic", label: "Basic Fields" },
  { path: "/nested", label: "Nested Objects" },
  { path: "/array", label: "Arrays" },
  { path: "/validation", label: "Validation" },
  { path: "/dynamic", label: "Dynamic (ui.fn.*)" },
  { path: "/select-radio", label: "Select / Radio" },
  { path: "/custom", label: "Custom Components" },
  { path: "/ref", label: "FK Ref (Value Help)" },
];

const wfRoutes = [
  { path: "/wf-auth", label: "Auth Flow" },
  { path: "/wf-profile", label: "Profile Draft" },
];

const tableRoutes = [
  { path: "/products-table", label: "Products" },
  { path: "/customers-table", label: "Customers" },
  { path: "/custom-slots-table", label: "Custom Slots" },
  { path: "/virtual-scroll-table", label: "Virtual Scroll (5k)" },
  { path: "/orders-table", label: "Orders (FK)" },
];

const toastMessage = ref("");
const toastVisible = ref(false);
let toastTimer: ReturnType<typeof setTimeout>;

function showToast(message: string) {
  toastMessage.value = message;
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 2500);
}

provide("showToast", showToast);

const dark = ref(false);

function applyDark(on: boolean) {
  const html = document.documentElement;
  html.classList.toggle("dark", on);
  html.setAttribute("data-theme", on ? "dark" : "light");
  try {
    localStorage.setItem("as-theme", on ? "dark" : "light");
  } catch {}
}

function toggleDark() {
  dark.value = !dark.value;
  applyDark(dark.value);
}

onMounted(() => {
  let initial = false;
  try {
    const saved = localStorage.getItem("as-theme");
    if (saved) initial = saved === "dark";
    else initial = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {}
  dark.value = initial;
  applyDark(initial);
});
</script>

<template>
  <div class="scope-primary layer-0 min-h-100vh flex font-[var(--as-font-ui)] text-[length:var(--as-fs-base)]">
    <aside
      class="layer-1 w-[220px] shrink-0 sticky top-0 h-100vh overflow-y-auto border-r-1 border-r-solid border-r-current/10 flex flex-col"
    >
      <div class="flex items-center gap-$xs px-$m pt-$m pb-$s border-b-1 border-b-solid border-b-current/10">
        <span class="i-as-sparkle text-lg text-scope-primary-500" aria-hidden="true" />
        <h1 class="m-0 text-[length:var(--as-fs-md)] font-600 tracking-tight">
          AS UI Playground
        </h1>
      </div>
      <nav class="flex flex-col gap-[2px] px-$xs py-$s flex-1">
        <span class="nav-section">Forms</span>
        <RouterLink v-for="r in formRoutes" :key="r.path" :to="r.path" class="nav-link">
          {{ r.label }}
        </RouterLink>
        <span class="nav-section">Workflows</span>
        <RouterLink v-for="r in wfRoutes" :key="r.path" :to="r.path" class="nav-link">
          {{ r.label }}
        </RouterLink>
        <span class="nav-section">Tables</span>
        <RouterLink v-for="r in tableRoutes" :key="r.path" :to="r.path" class="nav-link">
          {{ r.label }}
        </RouterLink>
      </nav>
      <div class="px-$m py-$s border-t-1 border-t-solid border-t-current/10">
        <button
          type="button"
          class="theme-toggle"
          :aria-label="dark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleDark"
        >
          <span :class="dark ? 'i-as-sun' : 'i-as-moon'" aria-hidden="true" />
          {{ dark ? "Light mode" : "Dark mode" }}
        </button>
      </div>
    </aside>
    <main class="flex-1 min-w-0 px-[40px] py-[28px] overflow-x-hidden">
      <RouterView />
    </main>
    <Transition name="toast">
      <div v-if="toastVisible" class="toast">{{ toastMessage }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.nav-section {
  display: block;
  font-family: var(--as-font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: currentColor;
  opacity: 0.45;
  margin-top: 10px;
  padding: 4px 12px 2px;
}

.nav-link {
  display: block;
  padding: 6px 12px;
  border-radius: var(--as-radius-sm);
  font-size: var(--as-fs-sm);
  color: currentColor;
  text-decoration: none;
  transition:
    background 0.15s,
    color 0.15s;
  opacity: 0.85;
}

.nav-link:hover {
  background: rgba(148, 163, 184, 0.12);
  opacity: 1;
}

.nav-link.router-link-active {
  background: rgb(var(--scope-color-500) / 0.12);
  color: rgb(var(--scope-color-600));
  font-weight: 500;
  opacity: 1;
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: var(--as-radius-sm);
  background: transparent;
  color: currentColor;
  cursor: pointer;
  font: inherit;
  font-size: var(--as-fs-sm);
  transition:
    background 0.15s,
    border-color 0.15s;
  opacity: 0.8;
}

.theme-toggle:hover {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.35);
  opacity: 1;
}

.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  background: rgb(var(--scope-color-600));
  color: #fff;
  border-radius: var(--as-radius);
  font-size: var(--as-fs-sm);
  font-weight: 500;
  box-shadow: var(--as-shadow-dialog);
  z-index: 100;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
