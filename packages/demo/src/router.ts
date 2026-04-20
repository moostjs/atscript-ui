import { createMemoryHistory, createRouter as _createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/", component: () => import("./pages/Home.vue") },
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
