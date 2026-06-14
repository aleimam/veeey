import { test, expect } from '@playwright/test';

test('admin product list requires authentication', async ({ page }) => {
  await page.goto('/en/admin/products');
  await expect(page).toHaveURL(/\/en\/login$/);
});

test('admin image upload rejects unauthenticated requests', async ({ request }) => {
  const res = await request.post('/api/admin/upload', {
    multipart: { file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') } },
  });
  expect(res.status()).toBe(403);
});
