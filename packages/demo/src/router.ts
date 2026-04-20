import { createMemoryHistory, createRouter as _createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/login", name: "login", component: () => import("./client/pages/login.vue") },
  { path: "/register", name: "register", component: () => import("./client/pages/register.vue") },
  { path: "/profile", name: "profile", component: () => import("./client/pages/profile.vue") },
  {
    path: "/profile/change-password",
    name: "change-password",
    component: () => import("./client/pages/change-password.vue"),
  },
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
