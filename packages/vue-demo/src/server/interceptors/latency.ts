import { defineBeforeInterceptor, TInterceptorPriority } from "moost";
import { useRequest } from "@wooksjs/event-http";

const META_DELAY_MS = 50;
const DATA_DELAY_MS = 100;

// E2E tests opt out via this env var. The Playwright rig sets it in
// `tests/e2e/global-setup.ts` so the broad test population isn't paying
// 100 ms × N round-trips for no coverage gain — specs that DO need to
// observe loading states (Scenario 12.1) inject their own delay via
// `page.route(...)`, which is more deterministic than the natural latency.
const SKIP_LATENCY = process.env.DEMO_NO_LATENCY === "1";

export const latencyInterceptor = defineBeforeInterceptor(async () => {
  if (SKIP_LATENCY) return;
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
