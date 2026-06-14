import { test, expect } from '@playwright/test';

test('admin redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/en/admin');
  await expect(page).toHaveURL(/\/en\/login$/);
});

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/en/login');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sign in');
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test('register page renders and links back to login', async ({ page }) => {
  await page.goto('/en/register');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Create');
  await expect(page.locator('input[name="name"]')).toBeVisible();
});
