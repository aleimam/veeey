import { test, expect } from '@playwright/test';

test('events ingest endpoint accepts a beacon', async ({ request }) => {
  const res = await request.post('/api/events', {
    data: { sessionId: 'sess-e2e-12345', consent: null, events: [{ name: 'page_view', path: '/en' }] },
  });
  expect(res.status()).toBe(204);
});

test('events endpoint swallows malformed payloads', async ({ request }) => {
  const res = await request.post('/api/events', { data: { garbage: true } });
  expect(res.status()).toBe(204);
});
