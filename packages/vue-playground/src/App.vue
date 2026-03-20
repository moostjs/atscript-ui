<script setup lang="ts">
import { provide, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";

const routes = [
  { path: "/", label: "Home" },
  { path: "/basic", label: "Basic Fields" },
  { path: "/nested", label: "Nested Objects" },
  { path: "/array", label: "Arrays" },
  { path: "/validation", label: "Validation" },
  { path: "/dynamic", label: "Dynamic (ui.fn.*)" },
  { path: "/select-radio", label: "Select / Radio" },
  { path: "/custom", label: "Custom Components" },
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
        <RouterLink v-for="r in routes" :key="r.path" :to="r.path">
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
