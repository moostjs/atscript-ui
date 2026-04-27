<script setup lang="ts">
import { onMounted, provide, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import vueFormPkg from "@atscript/vue-form/package.json";

const version = `v${vueFormPkg.version}`;

const getStartedRoutes = [{ path: "/", label: "Home", icon: "sun" }];

const formRoutes = [
  { path: "/basic", label: "Basic Fields" },
  { path: "/nested", label: "Nested Objects" },
  { path: "/array", label: "Arrays" },
  { path: "/validation", label: "Validation" },
  { path: "/select-radio", label: "Select / Radio" },
];

const wfRoutes = [
  { path: "/dynamic", label: "Dynamic (ui.fn.*)" },
  { path: "/custom", label: "Custom Components" },
  { path: "/ref", label: "FK Ref (Value Help)" },
  { path: "/wf-auth", label: "Auth Flow" },
  { path: "/wf-profile", label: "Profile Draft" },
];

const tableRoutes = [
  { path: "/products-table", label: "Products" },
  { path: "/customers-table", label: "Customers" },
  { path: "/custom-slots-table", label: "Custom Slots" },
  { path: "/virtual-scroll-table", label: "Virtual Scroll (5k)", count: "5k" },
  { path: "/window-table", label: "Window Table" },
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
  <div class="h-100vh overflow-hidden flex layer-1">
    <aside
      class="w-[18em] shrink-0 sticky top-0 h-100vh overflow-y-auto flex flex-col layer-0 border-r-1"
    >
      <div class="flex items-center gap-$s px-$m pt-$m pb-$m border-b-1">
        <svg
          width="24"
          height="24"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g clip-path="url(#clip0_2163_24)">
            <path d="M0 99.5L64 128V57L0 28.5V99.5Z" fill="#5A2DFC" />
            <path d="M64 128L128 99.5V28.5L64 57V128Z" fill="#380DD6" />
            <path d="M128 76.5L64 105L0 76.5" stroke="#471AEC" />
            <path d="M128 51.5L64 80L0 51.5" stroke="#471AEC" />
            <path d="M64 0L128 28.5L64 57L0 28.5L64 0Z" fill="url(#paint0_linear_2163_24)" />
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M73.5 67L75.9994 67C85.3881 67 93 74.611 93 84V112C93 116.971 88.9706 121 84 121H83C79.0813 121 75.7476 118.496 74.5121 115H66C62.134 115 59 111.866 59 108V90C59 86.134 62.134 83 66 83H80V112C80 113.657 81.3431 115 83 115H84C85.6569 115 87 113.657 87 112V84C87 77.925 82.0747 73 75.9994 73L73.5 73C70.7947 73 67.825 73.8496 65.4031 74.7947C64.2193 75.2567 63.2223 75.7192 62.5259 76.0638C62.1786 76.2356 61.9087 76.3769 61.7305 76.4724C61.6415 76.5201 61.5756 76.5563 61.5346 76.579L61.4921 76.6027L61.4875 76.6053C61.4879 76.605 61.4884 76.6047 60 74C58.5116 71.3953 58.5121 71.395 58.5127 71.3946L58.517 71.3922L58.5249 71.3877L58.5485 71.3744L58.6258 71.3312C58.6906 71.2953 58.7814 71.2455 58.8965 71.1839C59.1265 71.0606 59.4542 70.8894 59.8648 70.6862C60.684 70.2808 61.8432 69.7433 63.2219 69.2053C65.925 68.1504 69.7053 67 73.5 67ZM74 109V89H66C65.4477 89 65 89.4477 65 90V108C65 108.552 65.4477 109 66 109H74ZM61.4856 76.6063C61.4853 76.6065 61.4851 76.6066 61.4856 76.6063Z"
              fill="white"
            />
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M116.768 91.5327L111.312 93.2596L110.998 92.3298C110.806 91.7597 110.519 91.1953 110.129 90.6363L110.117 90.6188C109.786 90.1216 109.324 89.6965 108.705 89.3501C108.155 89.0427 107.386 88.8539 106.338 88.8539C104.929 88.8539 103.832 89.2138 102.98 89.8729L102.978 89.8743C102.16 90.5042 101.797 91.2457 101.797 92.1612C101.797 93.031 102.068 93.617 102.544 94.0406C103.1 94.5361 104.057 95.0188 105.524 95.4293L105.526 95.4299L109.37 96.4858C111.806 97.1473 113.736 98.1888 115.044 99.6802C116.371 101.18 117 103.086 117 105.31C117 107.153 116.523 108.83 115.555 110.313C114.604 111.786 113.28 112.934 111.614 113.762C109.932 114.598 108.006 115 105.865 115C103.054 115 100.641 114.315 98.6987 112.877C96.7288 111.417 95.5171 109.3 95.0171 106.627L94.8487 105.727L100.523 104.14L100.758 105.161C101.08 106.557 101.663 107.503 102.44 108.109C103.235 108.72 104.325 109.071 105.797 109.071C107.501 109.071 108.73 108.668 109.594 107.97C110.5 107.237 110.878 106.437 110.878 105.537C110.878 104.757 110.643 104.163 110.199 103.685L110.193 103.678C109.738 103.179 108.972 102.735 107.775 102.424L103.447 101.289C100.952 100.628 98.994 99.5717 97.7017 98.0388L97.6954 98.0314C96.421 96.4897 95.8108 94.5848 95.8108 92.3879C95.8108 90.5744 96.269 88.9326 97.2065 87.4962L97.2099 87.491C98.1455 86.0771 99.414 84.9745 100.991 84.1831L100.993 84.1817C102.591 83.3862 104.38 83 106.338 83C109.064 83 111.338 83.67 113.036 85.1299C114.673 86.5277 115.817 88.3617 116.485 90.5893L116.768 91.5327Z"
              fill="white"
            />
          </g>
          <defs>
            <linearGradient
              id="paint0_linear_2163_24"
              x1="55.7241"
              y1="-19.6919"
              x2="101.069"
              y2="52.2332"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#5628FA" />
              <stop offset="0.317308" stop-color="#6B42FF" />
              <stop offset="1" stop-color="#5D30FF" />
            </linearGradient>
            <clipPath id="clip0_2163_24">
              <rect width="128" height="128" fill="white" />
            </clipPath>
          </defs>
        </svg>

        <span class="font-600 tracking-tight text-grey-800 dark:text-grey-100">UI Playground</span>
        <span
          class="scope-grey ml-auto font-mono text-callout text-current/60 px-$xs py-[0.15em] rounded-r0 layer-2"
          >{{ version }}</span
        >
      </div>
      <nav class="flex flex-col px-$xs pb-$m pt-0 flex-1">
        <span class="nav-section">Getting Started</span>
        <RouterLink
          v-for="r in getStartedRoutes"
          :key="r.path"
          :to="r.path"
          class="nav-link"
          active-class="nav-link-active"
        >
          <span class="i-as-sun w-[1.1em] h-[1.1em] shrink-0 op-65" aria-hidden="true" />
          <span class="flex-1 min-w-0 truncate">{{ r.label }}</span>
        </RouterLink>

        <span class="nav-section">Forms</span>
        <RouterLink
          v-for="r in formRoutes"
          :key="r.path"
          :to="r.path"
          class="nav-link"
          active-class="nav-link-active"
        >
          <span class="i-as-check-square w-[1.1em] h-[1.1em] shrink-0 op-65" aria-hidden="true" />
          <span class="flex-1 min-w-0 truncate">{{ r.label }}</span>
        </RouterLink>

        <span class="nav-section">Workflows</span>
        <RouterLink
          v-for="r in wfRoutes"
          :key="r.path"
          :to="r.path"
          class="nav-link"
          active-class="nav-link-active"
        >
          <span class="i-as-refresh w-[1.1em] h-[1.1em] shrink-0 op-65" aria-hidden="true" />
          <span class="flex-1 min-w-0 truncate">{{ r.label }}</span>
        </RouterLink>

        <span class="nav-section">Tables</span>
        <RouterLink
          v-for="r in tableRoutes"
          :key="r.path"
          :to="r.path"
          class="nav-link"
          active-class="nav-link-active"
        >
          <span class="i-as-columns w-[1.1em] h-[1.1em] shrink-0 op-65" aria-hidden="true" />
          <span class="flex-1 min-w-0 truncate">{{ r.label }}</span>
          <span
            v-if="r.count"
            class="scope-grey font-mono text-callout text-current/60 px-$xs py-[0.08em] rounded-r0 layer-2"
            >{{ r.count }}</span
          >
        </RouterLink>
      </nav>
      <div class="p-$s border-t-1">
        <button
          type="button"
          class="c8-flat scope-grey inline-flex items-center gap-$xs w-full px-$s py-$xs border-1 rounded-base cursor-pointer text-callout font-inherit"
          :aria-label="dark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleDark"
        >
          <span :class="dark ? 'i-as-sun' : 'i-as-moon'" aria-hidden="true" />
          <span>{{ dark ? "Light mode" : "Dark mode" }}</span>
        </button>
      </div>
    </aside>
    <main class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <RouterView />
    </main>
    <Transition name="toast">
      <div
        v-if="toastVisible"
        class="fixed bottom-$l right-$l px-$l py-$m bg-primary-600 text-white rounded-r2 text-callout font-500 shadow-popup z-100"
      >
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
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
