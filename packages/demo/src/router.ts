import { createMemoryHistory, createRouter as _createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/login", name: "login", component: () => import("./client/pages/login.vue") },
  { path: "/", name: "dashboard", component: () => import("./client/pages/dashboard.vue") },
  { path: "/:table", name: "table", component: () => import("./client/pages/table-page-route.vue") },
  {
    path: "/:table/:id/edit",
    name: "edit-by-path",
    component: () => import("./client/pages/edit-page.vue"),
  },
];

export function createRouter() {
  return _createRouter({
    history: import.meta.env.SSR ? createMemoryHistory() : createWebHistory(),
    routes,
  });
}
