<script setup lang="ts">
import { provide, ref } from "vue";
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
</script>

<template>
  <div class="app-layout">
    <aside class="app-sidebar">
      <h1>AS UI Playground</h1>
      <nav>
        <span class="nav-section">Forms</span>
        <RouterLink v-for="r in formRoutes" :key="r.path" :to="r.path">
          {{ r.label }}
        </RouterLink>
        <span class="nav-section">Workflows</span>
        <RouterLink v-for="r in wfRoutes" :key="r.path" :to="r.path">
          {{ r.label }}
        </RouterLink>
        <span class="nav-section">Tables</span>
        <RouterLink v-for="r in tableRoutes" :key="r.path" :to="r.path">
          {{ r.label }}
        </RouterLink>
      </nav>
    </aside>
    <main class="app-main">
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
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
  margin-top: 12px;
  padding: 4px 12px;
}

.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  background: #065f46;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
