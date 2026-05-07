// Scenario 1.2 — Navigate between tables.
//
// Asserts the sidebar→table-page round trip:
//   - URL flips to /<table>
//   - /api/db/tables/<table>/meta + /pages both fire
//   - Page heading swaps
//   - Active link state migrates between sidebar entries

import { expect, test } from "../fixtures";

test("sidebar links cycle Users → Orders, fetch meta + pages each time", async ({ page }) => {
  await page.goto("/");

  // Users
  const usersMeta = page.waitForResponse("**/api/db/tables/users/meta");
  const usersPages = page.waitForResponse("**/api/db/tables/users/pages**");
  await page.getByRole("link", { name: "Users", exact: true }).click();
  await Promise.all([usersMeta, usersPages]);
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveClass(
    /nav-link-active/,
  );

  // Orders — separate /meta because the cache is per-table.
  const ordersMeta = page.waitForResponse("**/api/db/tables/orders/meta");
  const ordersPages = page.waitForResponse("**/api/db/tables/orders/pages**");
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await Promise.all([ordersMeta, ordersPages]);
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Orders", exact: true })).toHaveClass(
    /nav-link-active/,
  );
  await expect(page.getByRole("link", { name: "Users", exact: true })).not.toHaveClass(
    /nav-link-active/,
  );
});
