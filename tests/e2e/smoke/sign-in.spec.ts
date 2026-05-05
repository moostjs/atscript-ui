// Scenario 1.1 — Sign in and land on dashboard.
//
// This spec proves the auth fixture in `auth.setup.ts` actually wrote a
// valid `demo.sid` cookie: we navigate as the (default) `admin` storage
// state and assert the sidebar greets us by username/role. If the cookie
// were missing or rejected, `<AppShell>` redirects to `/login` and the
// "Signed in as ..." line never renders.

import { expect, test } from "@playwright/test";

test("admin storage state lands on the dashboard", async ({ page }) => {
  await page.goto("/");

  // The sidebar marker — an exact text match would be brittle (the
  // strong tag re-renders) so we match on the wrapper plus the role
  // suffix in parallel.
  await expect(page.getByText(/Signed in as/i)).toBeVisible();
  await expect(page.getByText(/\(admin\)/)).toBeVisible();

  // The dashboard renders cards titled "Users 5" / "Orders 15" / etc., so
  // "name: 'Users'" without `exact` matches both the sidebar link and the
  // dashboard card. Scope to the sidebar nav explicitly.
  const sidebar = page.getByRole("navigation");
  await expect(sidebar.getByRole("link", { name: "Users", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Orders", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Audit Log", exact: true })).toBeVisible();
});
