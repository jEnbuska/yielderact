import { type Page } from '@playwright/test';

export async function goToApp(page: Page) {
  await page.goto('/');
  await page.waitForSelector('h1');
}

export async function clickTab(page: Page, label: string) {
  await page.getByRole('tab', { name: label }).click();
}

export async function goToTab(page: Page, label: string) {
  await goToApp(page);
  await clickTab(page, label);
}
