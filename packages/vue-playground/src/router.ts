import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("./views/HomeView.vue"),
    },
    {
      path: "/basic",
      name: "basic",
      component: () => import("./views/BasicFormView.vue"),
    },
    {
      path: "/nested",
      name: "nested",
      component: () => import("./views/NestedFormView.vue"),
    },
    {
      path: "/array",
      name: "array",
      component: () => import("./views/ArrayFormView.vue"),
    },
    {
      path: "/validation",
      name: "validation",
      component: () => import("./views/ValidationFormView.vue"),
    },
    {
      path: "/dynamic",
      name: "dynamic",
      component: () => import("./views/DynamicFormView.vue"),
    },
    {
      path: "/select-radio",
      name: "select-radio",
      component: () => import("./views/SelectRadioView.vue"),
    },
    {
      path: "/custom",
      name: "custom",
      component: () => import("./views/CustomComponentsView.vue"),
    },
  ],
});

export default router;
