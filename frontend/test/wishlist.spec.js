import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { readFileSync } from 'node:fs';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const mongoose = requireBackend('mongoose');
const password = 'wishlistpass123';
let email;
test.beforeEach(async ({ request }) => {
  email = `wishlist-browser-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const response = await request.post('http://127.0.0.1:5000/customers/register', { data: { fullName: 'Wishlist Customer', email, password, phone: '9876543210' } });
  expect(response.status()).toBe(201);
});
test.afterEach(async () => {
  const env = parseEnv(readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8'));
  const connection = await mongoose.createConnection(env.MONGODB_URI).asPromise();
  try { await connection.collection('customers').deleteOne({ email }); }
  finally { await connection.close(); }
});
async function login(page) {
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

test('wishlist browser journey: login return, toggle/count, refresh, relogin, details and remove', async ({ page }) => {
  await page.goto('/wishlist');
  await expect(page).toHaveURL(/\/login$/);
  await login(page);
  await expect(page).toHaveURL(/\/wishlist$/);
  await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse Products' }).click();
  const card = page.locator('.product-card').filter({ hasText: 'Mechanical Keyboard' });
  await card.getByRole('button', { name: 'Add to Wishlist' }).click();
  await expect(card.getByRole('button', { name: 'Remove from Wishlist' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Wishlist (1)', exact: true })).toBeVisible();
  await page.reload();
  await expect(card.getByRole('button', { name: 'Remove from Wishlist' })).toBeVisible();
  await card.getByRole('button', { name: 'Remove from Wishlist' }).click();
  await expect(card.getByRole('button', { name: 'Add to Wishlist' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Wishlist (0)', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Add to Wishlist' }).click();
  await expect(page.getByRole('link', { name: 'Wishlist (1)', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Wishlist (1)', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.product-card')).toContainText('Mechanical Keyboard');
  await page.getByRole('button', { name: 'Log out' }).click();
  await login(page);
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('link', { name: 'Wishlist (1)', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/shopkart-wishlist-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '/tmp/shopkart-wishlist-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'View Details' }).click();
  await expect(page.getByRole('heading', { name: 'Mechanical Keyboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove from Wishlist' })).toBeVisible();
  await page.getByRole('link', { name: 'Wishlist (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Remove from Wishlist' }).click();
  await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Wishlist (0)', exact: true })).toBeVisible();
});

test('wishlist loading/error/retry, failed mutations, pending lock and guest save', async ({ page }) => {
  await page.goto('/login'); await login(page);
  await expect(page).toHaveURL(/\/home$/);
  await page.route('**/api/wishlist', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Temporary wishlist error"}' });
  });
  await page.goto('/wishlist');
  await expect(page.getByText('Loading your wishlist...', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Unable to load wishlist');
  await page.unroute('**/api/wishlist');
  await page.getByRole('button', { name: 'Try Again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  await page.goto('/products?search=keyboard');
  const button = page.getByRole('button', { name: 'Add to Wishlist' });
  await expect(button).toBeEnabled();
  let writes = 0;
  await page.route('**/api/wishlist/*', async route => {
    writes++;
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Write unavailable"}' });
  });
  await button.click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Unable to save product');
  expect(writes).toBe(1);
  await page.unroute('**/api/wishlist/*');
  await button.click();
  await expect(page.getByRole('button', { name: 'Remove from Wishlist' })).toBeVisible();
  await page.getByRole('link', { name: 'Wishlist (1)', exact: true }).click();
  await page.route('**/api/wishlist/*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Remove unavailable"}' }));
  await page.getByRole('button', { name: 'Remove from Wishlist' }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to remove product');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.unroute('**/api/wishlist/*');
  await page.getByRole('button', { name: 'Remove from Wishlist' }).click();
  await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto('/products?search=keyboard');
  await expect(page.getByRole('button', { name: 'Add to Wishlist' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add to Wishlist' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page);
  await expect(page).toHaveURL(/\/products\?search=keyboard$/);
});
