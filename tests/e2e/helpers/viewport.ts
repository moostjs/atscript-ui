import type { Page } from "@playwright/test";

/** Phone-portrait — exercises the mobile-fullscreen dialog branch (Section 18). */
export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

/** Default desktop. Matches Playwright's chromium device default. */
export const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;

export async function setMobileViewport(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORT);
}

export async function setDesktopViewport(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP_VIEWPORT);
}
