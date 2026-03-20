<script setup lang="ts">
import { RouterLink } from "vue-router";

const demos = [
  {
    path: "/basic",
    label: "Basic Fields",
    desc: "Text, number, email, password, disabled, readonly",
  },
  { path: "/nested", label: "Nested Objects", desc: "Deep nested objects with grouped fields" },
  { path: "/array", label: "Arrays", desc: "String, number, object, and union arrays" },
  { path: "/validation", label: "Validation", desc: "@expect.* constraints and @ui.validate" },
  {
    path: "/dynamic",
    label: "Dynamic (ui.fn.*)",
    desc: "Computed labels, hidden, disabled, options",
  },
  {
    path: "/select-radio",
    label: "Select / Radio",
    desc: "Select, radio, checkbox with static options",
  },
  { path: "/custom", label: "Custom Components", desc: "BYOUI pattern with custom type overrides" },
];
</script>

<template>
  <h2>ATScript UI Playground</h2>
  <p style="color: #6b7280; margin-bottom: 24px">
    Demo and test cases for <code>@atscript/vue-form</code> components.
  </p>
  <div class="demo-grid">
    <RouterLink v-for="d in demos" :key="d.path" :to="d.path" class="demo-card">
      <span class="demo-card-label">{{ d.label }}</span>
      <span class="demo-card-desc">{{ d.desc }}</span>
    </RouterLink>
  </div>
</template>

<style scoped>
.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.demo-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  text-decoration: none;
  transition: all 0.15s;
}

.demo-card:hover {
  border-color: #6366f1;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

.demo-card-label {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.demo-card-desc {
  font-size: 13px;
  color: #6b7280;
}
</style>
