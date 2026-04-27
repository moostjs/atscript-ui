import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("./views/HomeView.vue"),
    },
    // Forms
    {
      path: "/basic",
      name: "basic",
      component: () => import("./views/forms/BasicFormView.vue"),
    },
    {
      path: "/nested",
      name: "nested",
      component: () => import("./views/forms/NestedFormView.vue"),
    },
    {
      path: "/array",
      name: "array",
      component: () => import("./views/forms/ArrayFormView.vue"),
    },
    {
      path: "/validation",
      name: "validation",
      component: () => import("./views/forms/ValidationFormView.vue"),
    },
    {
      path: "/dynamic",
      name: "dynamic",
      component: () => import("./views/forms/DynamicFormView.vue"),
    },
    {
      path: "/select-radio",
      name: "select-radio",
      component: () => import("./views/forms/SelectRadioView.vue"),
    },
    {
      path: "/custom",
      name: "custom",
      component: () => import("./views/forms/CustomComponentsView.vue"),
    },
    {
      path: "/ref",
      name: "ref",
      component: () => import("./views/forms/RefFormView.vue"),
    },
    // Tables
    {
      path: "/products-table",
      name: "products-table",
      component: () => import("./views/tables/ProductsTableView.vue"),
    },
    {
      path: "/customers-table",
      name: "customers-table",
      component: () => import("./views/tables/CustomersTableView.vue"),
    },
    {
      path: "/custom-slots-table",
      name: "custom-slots-table",
      component: () => import("./views/tables/CustomSlotsTableView.vue"),
    },
    {
      path: "/virtual-scroll-table",
      name: "virtual-scroll-table",
      component: () => import("./views/tables/VirtualScrollTableView.vue"),
    },
    {
      path: "/window-table",
      name: "window-table",
      component: () => import("./views/tables/WindowTableView.vue"),
    },
    {
      path: "/orders-table",
      name: "orders-table",
      component: () => import("./views/tables/OrdersTableView.vue"),
    },
    // Workflows
    {
      path: "/wf-auth",
      name: "wf-auth",
      component: () => import("./views/workflows/AuthFlowView.vue"),
    },
    {
      path: "/wf-profile",
      name: "wf-profile",
      component: () => import("./views/workflows/ProfileFlowView.vue"),
    },
  ],
});

export default router;
