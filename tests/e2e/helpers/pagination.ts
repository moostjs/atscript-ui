import type { Page } from "@playwright/test";

/**
 * Click the pagination button whose label is exactly `n`. The TablePage
 * pagination component renders page numbers as `.table-pagination-btn`
 * with the page number as text content.
 */
export async function clickPaginationPage(page: Page, n: number): Promise<void> {
  await page
    .locator(".table-pagination-btn")
    .filter({ hasText: new RegExp(`^${n}$`, "u") })
    .first()
    .click();
}

/** Click the `Next page` arrow in the pagination strip. */
export async function clickPaginationNext(page: Page): Promise<void> {
  await page.locator(".table-pagination-btn[aria-label='Next page']").click();
}

/**
 * Set the rows-per-page selector to `n`. The selector is a plain
 * `<select class="i8-filled">` inside `.table-pagination` (no Reka portal
 * — `selectOption` works directly).
 */
export async function setItemsPerPage(page: Page, n: number): Promise<void> {
  await page.locator(".table-pagination select.i8-filled").selectOption(String(n));
}
