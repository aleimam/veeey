import { test, expect } from '@playwright/test';

test('root redirects to a locale and renders the Veeey home', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/(en|ar)$/);
  await expect(page).toHaveTitle(/Veeey/);
  await expect(page.getByRole('link', { name: 'Veeey home' })).toBeVisible();
});

test('Arabic locale renders right-to-left', async ({ page }) => {
  await page.goto('/ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('health endpoint responds ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ status: 'ok' });
});
