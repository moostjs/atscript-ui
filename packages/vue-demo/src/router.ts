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
    path: "/wf-demo",
    name: "wf-demo",
    component: () => import("./client/pages/wf-demo/index.vue"),
  },
  {
    path: "/wf-demo/finish-immediate",
    name: "wf-demo-finish-immediate",
    component: () => import("./client/pages/wf-demo/finish-immediate.vue"),
  },
  {
    path: "/wf-demo/finish-auto",
    name: "wf-demo-finish-auto",
    component: () => import("./client/pages/wf-demo/finish-auto.vue"),
  },
  {
    path: "/wf-demo/finish-manual",
    name: "wf-demo-finish-manual",
    component: () => import("./client/pages/wf-demo/finish-manual.vue"),
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
    path: "/forms-demo/tuples",
    name: "forms-demo-tuples",
    component: () => import("./client/pages/forms-demo/tuples.vue"),
  },
  {
    path: "/forms-demo/unions",
    name: "forms-demo-unions",
    component: () => import("./client/pages/forms-demo/unions.vue"),
  },
  {
    path: "/forms-demo/error-dismissal",
    name: "forms-demo-error-dismissal",
    component: () => import("./client/pages/forms-demo/error-dismissal.vue"),
  },
  {
    path: "/forms-demo/measurements",
    name: "forms-demo-measurements",
    component: () => import("./client/pages/forms-demo/measurements.vue"),
  },
  {
    path: "/forms-demo/measurements-optional",
    name: "forms-demo-measurements-optional",
    component: () => import("./client/pages/forms-demo/measurements-optional.vue"),
  },
  {
    path: "/forms-demo/dates",
    name: "forms-demo-dates",
    component: () => import("./client/pages/forms-demo/dates.vue"),
  },
  {
    path: "/forms-demo/adornments",
    name: "forms-demo-adornments",
    component: () => import("./client/pages/forms-demo/adornments.vue"),
  },
  {
    path: "/forms-demo/custom-components",
    name: "forms-demo-custom-components",
    component: () => import("./client/pages/forms-demo/custom-components.vue"),
  },
  {
    path: "/forms-demo/dynamic-form",
    name: "forms-demo-dynamic-form",
    component: () => import("./client/pages/forms-demo/dynamic-form.vue"),
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
