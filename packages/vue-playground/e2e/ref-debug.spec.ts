import { test, expect } from "@playwright/test";

test("debug: trace search request and response", async ({ page }) => {
  const networkLog: { url: string; status: number; body?: string }[] = [];
  page.on("response", async (resp) => {
    if (resp.url().includes("/db/")) {
      let body: string | undefined;
      try {
        body = await resp.text();
      } catch {}
      networkLog.push({ url: resp.url(), status: resp.status(), body: body?.substring(0, 200) });
    }
  });

  const consoleLogs: string[] = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  await page.goto("/ref");
  await expect(page.getByRole("heading", { name: "FK Ref (Value Help)" })).toBeVisible();

  // Enable Customer
  await page.getByRole("button", { name: "No Data" }).first().click();
  const combobox = page.getByRole("combobox", { name: "Customer" });
  await combobox.focus();
  await page.waitForTimeout(1000);

  networkLog.length = 0;

  await page.keyboard.press("Backspace");
  await page.keyboard.type("a", { delay: 50 });
  await page.waitForTimeout(1500);

  console.log("Network after typing 'a':");
  for (const entry of networkLog) {
    console.log(`  ${entry.status} ${entry.url}`);
    if (entry.body) console.log(`  body: ${entry.body}`);
  }
  console.log(
    "Console errors:",
    consoleLogs.filter((l) => l.startsWith("[error]")),
  );

  expect(true).toBe(true);
});
