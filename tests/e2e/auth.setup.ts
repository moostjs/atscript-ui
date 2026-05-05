import { test as setup } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { SERVER_URL } from "./global-setup";
import { authFileFor, DEMO_ROLES, performLogin } from "./helpers/auth";

setup.describe.configure({ mode: "serial" });

for (const role of DEMO_ROLES) {
  setup(`authenticate ${role.username}`, async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: SERVER_URL,
      extraHTTPHeaders: { "content-type": "application/json" },
    });
    try {
      await performLogin(ctx, role);
      const target = authFileFor(role.username);
      mkdirSync(dirname(target), { recursive: true });
      await ctx.storageState({ path: target });
    } finally {
      await ctx.dispose();
    }
  });
}
