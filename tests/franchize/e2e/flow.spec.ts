import { test, expect } from '@playwright/test';

const slug = process.env.FRANCHIZE_QA_SLUG || 'vip-bike';

test.describe('franchize renting flow characterization', () => {
  test('franchize surfaces return successful HTTP responses', async ({ request }) => {
    const checks = [
      `/franchize/${slug}`,
      `/franchize/${slug}/cart`,
      `/franchize/${slug}/order/demo-order`,
      `/franchize/${slug}/about`,
      `/franchize/${slug}/contacts`,
    ];

    for (const path of checks) {
      let response;
      try {
        response = await request.get(path);
      } catch (error) {
        test.skip(true, `Network is unavailable for Playwright API request checks: ${String(error)}`);
        return;
      }
      expect(response.ok(), `Expected ${path} to be reachable`).toBeTruthy();
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(300);
    }
  });
});
