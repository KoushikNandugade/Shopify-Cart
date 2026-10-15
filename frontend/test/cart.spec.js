import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { readFileSync } from 'node:fs';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const mongoose = requireBackend('mongoose');
const password = 'cartpass123';
let email, productId, stockProductId;
async function database(task) {
  const env = parseEnv(readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8'));
  const connection = await mongoose.createConnection(env.MONGODB_URI).asPromise();
  try { return await task(connection); } finally { await connection.close(); }
}
test.beforeEach(async ({ request }) => {
  email = `cart-browser-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const response = await request.post('http://127.0.0.1:5000/customers/register', { data: { fullName: 'Cart Customer', email, password, phone: '9876543210' } });
  expect(response.status()).toBe(201);
  await database(async connection => {
    const result = await connection.collection('products').insertOne({ name: 'Browser Cart Product', description: 'A browser test product', price: 125.5, category: 'Test', image: '/product-images/book.svg', stock: 3, createdAt: new Date() });
    productId = result.insertedId.toString();
    const second = await connection.collection('products').insertOne({ name: 'Browser Second Product', description: 'Another test product', price: 50, category: 'Test', image: '/product-images/mug.svg', stock: 1, createdAt: new Date() });
    stockProductId = second.insertedId.toString();
  });
});
test.afterEach(async () => {
  await database(async connection => {
    await connection.collection('customers').deleteOne({ email });
    await connection.collection('products').deleteMany({ _id: { $in: [productId, stockProductId].map(id => new mongoose.Types.ObjectId(id)) } });
  });
});
async function login(page) {
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}
async function cartLink(page, count) { await expect(page.getByRole('link', { name: `Cart (${count})`, exact: true })).toBeVisible(); }

test('cart journey: shared counts, quantities, subtotal, persistence, stock limits and removal', async ({ page }) => {
  await page.goto('/cart');
  await expect(page).toHaveURL(/\/login$/); await login(page);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await page.goto(`/products/${productId}`);
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  await cartLink(page, 1);
  await page.getByRole('button', { name: 'Add Another', exact: true }).click();
  await cartLink(page, 2);
  await page.goto(`/products/${stockProductId}`);
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  await cartLink(page, 3);
  await page.getByRole('link', { name: 'Cart (3)', exact: true }).click();
  await expect(page.locator('.cart-item')).toHaveCount(2);
  await expect(page.getByTestId('cart-subtotal')).toHaveText('₹301.00');
  await page.getByRole('button', { name: 'Increase Browser Cart Product', exact: true }).click();
  await cartLink(page, 4);
  await expect(page.getByTestId('cart-subtotal')).toHaveText('₹426.50');
  await expect(page.getByRole('button', { name: 'Increase Browser Cart Product', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Decrease Browser Cart Product', exact: true }).click();
  await cartLink(page, 3);
  await expect(page.getByTestId('cart-subtotal')).toHaveText('₹301.00');
  await page.reload();
  await cartLink(page, 3);
  await expect(page.getByTestId('cart-units')).toHaveText('3');
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByRole('link', { name: 'Back to cart' }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Increase Browser Cart Product', exact: true }).click();
  await cartLink(page, 4);
  await page.getByRole('button', { name: 'Decrease Browser Cart Product', exact: true }).click();
  await cartLink(page, 3);
  await page.screenshot({ path: '/tmp/shopkart-cart-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '/tmp/shopkart-cart-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('link', { name: 'Cart', exact: true })).toBeVisible();
  await login(page);
  await expect(page).toHaveURL(/\/home$/); await cartLink(page, 3);
  await page.getByRole('link', { name: 'Cart (3)', exact: true }).click();
  await page.getByRole('button', { name: 'Decrease Browser Cart Product', exact: true }).click();
  await cartLink(page, 2);
  await expect(page.getByRole('button', { name: 'Decrease Browser Cart Product', exact: true })).toBeDisabled();
  await page.locator('.cart-item').filter({ hasText: 'Browser Cart Product' }).getByRole('button', { name: 'Remove', exact: true }).click();
  await cartLink(page, 1);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible(); await cartLink(page, 0);
});

test('cart read retry, per-item write failures, changed stock/price and unavailable product', async ({ page }) => {
  await page.goto('/login'); await login(page); await expect(page).toHaveURL(/\/home$/);
  await page.route('**/api/cart', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Temporary cart error"}' });
  });
  await page.goto('/cart');
  await expect(page.getByText('Loading your cart...', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Unable to load your cart');
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('button', { name: 'Try Again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await page.goto(`/products/${productId}`);
  await page.route('**/api/cart/*', async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Write unavailable"}' });
  });
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Adding…' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Write unavailable'); await cartLink(page, 0);
  await page.unroute('**/api/cart/*');
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click(); await cartLink(page, 1);
  await page.getByRole('button', { name: 'Add Another' }).click(); await cartLink(page, 2);
  await database(connection => connection.collection('products').updateOne({ _id: new mongoose.Types.ObjectId(productId) }, { $set: { price: 150, stock: 1 } }));
  await page.getByRole('link', { name: 'Cart (2)', exact: true }).click();
  await expect(page.getByTestId('cart-subtotal')).toHaveText('₹300.00');
  await expect(page.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
  await page.getByRole('button', { name: 'Decrease Browser Cart Product', exact: true }).click(); await cartLink(page, 1);
  await expect(page.getByTestId('cart-subtotal')).toHaveText('₹150.00');
  await page.route('**/api/cart/*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Remove unavailable"}' }));
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Remove unavailable'); await cartLink(page, 1);
  await page.unroute('**/api/cart/*');
  await database(connection => connection.collection('products').deleteOne({ _id: new mongoose.Types.ObjectId(productId) }));
  await page.getByRole('button', { name: 'Refresh prices & stock' }).click();
  await expect(page.getByText('This product is no longer available.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove unavailable item' }).click();
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});
