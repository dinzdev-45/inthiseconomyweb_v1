import { expect, type Page } from '@playwright/test';

/** The catalog's result count (the footer newsletter has its own status region). */
export const resultCount = (page: Page) => page.locator('main [data-result-count]');

/** Product cards of the catalog grid. */
export const cards = (page: Page) => page.locator('main ul.grid:not([data-skeleton]) > li');

/** Opens a catalog URL and waits for the streamed results (the count) to arrive. */
export async function openCatalog(page: Page, url: string) {
  await page.goto(url);
  await expect(resultCount(page)).toBeVisible();
}

/** Names of the product cards on the current page, in order. */
export const cardNames = (page: Page) => cards(page).locator('h2').allTextContents();
