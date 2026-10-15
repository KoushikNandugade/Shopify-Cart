import { test, expect } from '@playwright/test';

test('real catalog: search, category, price sorting, details, refresh and stock', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'The whole collection' })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(8);
  await page.getByLabel('Search products', { exact: true }).fill('KEYBOARD');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card')).toContainText('Mechanical Keyboard');
  await page.getByLabel('CATEGORY', { exact: true }).selectOption('Books');
  await expect(page.getByRole('heading', { name: 'No products found.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.product-card')).toHaveCount(8);
  await page.getByLabel('SORT BY').selectOption('price_asc');
  await expect(page.locator('.product-card').first()).toContainText('Little Book of Ideas');
  await page.getByLabel('SORT BY').selectOption('price_desc');
  await expect(page.locator('.product-card').first()).toContainText('Everyday Headphones');
  await page.getByLabel('CATEGORY', { exact: true }).selectOption('Electronics');
  await expect(page.locator('.product-card')).toHaveCount(2);
  await page.locator('.product-card').filter({ hasText: 'Mechanical Keyboard' }).getByRole('link', { name: 'View Details' }).click();
  await expect(page.getByRole('heading', { name: 'Mechanical Keyboard' })).toBeVisible();
  await expect(page.locator('.detail-description')).toContainText('tactile switches');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add to Cart' })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/shopkart-detail-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/products?category=Fashion');
  await page.locator('.product-card').filter({ hasText: 'Everyday Sneakers' }).getByRole('link', { name: 'View Details' }).click();
  await expect(page.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
  await page.goto('/products');
  await expect(page.locator('.product-card')).toHaveCount(8);
  await page.screenshot({ path: '/tmp/shopkart-catalog-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '/tmp/shopkart-catalog-desktop.png', fullPage: true });
});

test('catalog loading, API error and retry; invalid and missing details', async ({ page }) => {
  await page.route('**/api/products?*', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Test service unavailable' }) });
  });
  await page.goto('/products');
  await expect(page.getByText('Loading products...', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Test service unavailable');
  await page.unroute('**/api/products?*');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.product-card')).toHaveCount(8);
  for (const id of ['invalid', '000000000000000000000000']) {
    await page.goto(`/products/${id}`);
    await expect(page.getByRole('heading', { name: 'Product not found.' })).toBeVisible();
  }
});
