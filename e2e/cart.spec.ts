import { test, expect } from '@playwright/test';

test('cart shows an empty state for a fresh visitor', async ({ page }) => {
  await page.goto('/en/cart');
  await expect(page.getByText(/cart is empty/i)).toBeVisible();
});

test('checkout redirects to cart when empty', async ({ page }) => {
  await page.goto('/en/checkout');
  await expect(page).toHaveURL(/\/en\/cart$/);
});

test('payment webhook accepts posts (best-effort)', async ({ request }) => {
  const res = await request.post('/api/payments/webhook/kashier', { data: { orderNumber: 'NO-SUCH-ORDER', status: 'paid' } });
  expect(res.ok()).toBeTruthy();
});
