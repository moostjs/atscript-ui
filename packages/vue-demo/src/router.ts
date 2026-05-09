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
  {
    path: "/preferences",
    name: "preferences",
    component: () => import("./client/pages/preferences.vue"),
  },
  {
    path: "/users/invite",
    name: "users-invite",
    component: () => import("./client/pages/invite-admin.vue"),
  },
  {
    path: "/invite/:token",
    name: "invite-accept",
    component: () => import("./client/pages/invite-accept.vue"),
  },
  {
    path: "/forms-demo",
    name: "forms-demo",
    component: () => import("./client/pages/forms-demo/index.vue"),
  },
  {
    path: "/forms-demo/nested-collapsible",
    name: "forms-demo-nested-collapsible",
    component: () => import("./client/pages/forms-demo/nested-collapsible.vue"),
  },
  {
    path: "/forms-demo/optional-fields",
    name: "forms-demo-optional-fields",
    component: () => import("./client/pages/forms-demo/optional-fields.vue"),
  },
  {
    path: "/forms-demo/nested-optionals",
    name: "forms-demo-nested-optionals",
    component: () => import("./client/pages/forms-demo/nested-optionals.vue"),
  },
  {
    path: "/forms-demo/grid-layout",
    name: "forms-demo-grid-layout",
    component: () => import("./client/pages/forms-demo/grid-layout.vue"),
  },
  {
    path: "/forms-demo/array-showcase",
    name: "forms-demo-array-showcase",
    component: () => import("./client/pages/forms-demo/array-showcase.vue"),
  },
  {
    path: "/:table",
    name: "table",
    component: () => import("./client/pages/table-page-route.vue"),
  },
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
