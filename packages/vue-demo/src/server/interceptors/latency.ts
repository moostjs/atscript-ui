import { defineBeforeInterceptor, TInterceptorPriority } from "moost";
import { useRequest } from "@wooksjs/event-http";

const META_DELAY_MS = 50;
const DATA_DELAY_MS = 100;

export const latencyInterceptor = defineBeforeInterceptor(async () => {
  const { url } = useRequest();
  const path = url?.split("?", 1)[0] ?? "";
  // Cheap discovery endpoints (`/meta`, `/capabilities`) get a tiny delay so
  // first-paint loading skeletons remain testable. Heavier data ops, mutations,
  // and `@DbAction*` invocations get a slightly longer one. All times are still
  // small enough that the demo feels responsive.
  const isMeta = path.endsWith("/meta") || path.endsWith("/capabilities");
  const delay = isMeta ? META_DELAY_MS : DATA_DELAY_MS;
  await new Promise((resolve) => setTimeout(resolve, delay));
}, TInterceptorPriority.BEFORE_ALL);
