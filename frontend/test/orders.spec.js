import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { readFileSync } from 'node:fs';
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const mongoose = requireBackend('mongoose');
let email, productId;
async function database(task) {
  const env = parseEnv(readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8'));
  const connection = await mongoose.createConnection(env.MONGODB_URI).asPromise();
  try { return await task(connection); } finally { await connection.close(); }
}
test.beforeEach(async ({ page, request }) => {
  email = `checkout-browser-${Date.now()}@example.com`;
  expect((await request.post('http://127.0.0.1:5000/customers/register', { data: { fullName: 'Checkout Customer', email, password: 'checkoutpass123', phone: '9876543210' } })).status()).toBe(201);
  await database(async db => {
    const result = await db.collection('products').insertOne({ name: 'Checkout Test Product', description: 'Test', price: 125.5, category: 'Test', stock: 5, image: '/product-images/book.svg', createdAt: new Date() });
    productId = result.insertedId.toString();
  });
  // Only the external payment provider is simulated; order/cart DB logic is real.
  await page.route('**/api/orders**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const response = await route.fetch({ url: `http://127.0.0.1:5001${path}` });
    await route.fulfill({ response });
  });
  await page.route('**/__test/pay', async route => { const response = await route.fetch({ url: 'http://127.0.0.1:5001/__test/pay' }); await route.fulfill({ response }); });
  await page.route('https://checkout.razorpay.com/v1/checkout.js', route => route.fulfill({ contentType: 'application/javascript', body: readFileSync(new URL('./fixtures/checkout-double.js', import.meta.url), 'utf8') }));
});
test.afterEach(async () => {
  await database(async db => {
    const customer = await db.collection('customers').findOne({ email });
    if (customer) await db.collection('orders').deleteMany({ user: customer._id });
    await db.collection('customers').deleteOne({ email });
    await db.collection('products').deleteOne({ _id: new mongoose.Types.ObjectId(productId) });
  });
});
async function start(page) {
  await page.goto('/checkout'); await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('checkoutpass123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await page.goto(`/products/${productId}`);
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Cart (1)', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Cart (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
}
async function address(page) {
  for (const [name, value] of [['Full name', 'Aarav Sharma'], ['Phone number', '9876543210'], ['Address line', '22 MG Road'], ['City', 'Bengaluru'], ['State', 'Karnataka'], ['Pincode', '560001']]) await page.getByLabel(name, { exact: true }).fill(value);
}
test('simulated gateway: validation, pending cart, signed verification, confirmation and historical order', async ({ page }) => {
  await start(page);
  let creates = 0;
  page.on('request', request => { if (request.url().endsWith('/api/orders/create-payment-order')) creates++; });
  await page.getByRole('button', { name: 'Pay with Razorpay (Test)' }).click();
  await expect(page.getByText('Full name is required.', { exact: true })).toBeVisible(); expect(creates).toBe(0);
  await address(page);
  await page.getByLabel('Pincode', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Pay with Razorpay (Test)' }).click();
  await expect(page.getByText('Pincode must contain 6 digits and start with 1–9.', { exact: true })).toBeVisible(); expect(creates).toBe(0);
  await page.getByLabel('Pincode', { exact: true }).fill('560001');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/shopkart-checkout-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Pay with Razorpay (Test)' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Complete simulated payment' }).click();
  await expect(page).toHaveURL(/\/order-success\/[a-f0-9]{24}$/);
  await expect(page.getByRole('heading', { name: 'Order Placed Successfully' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart (0)', exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/shopkart-order-success.png', fullPage: true });
  const successUrl = page.url();
  await database(db => db.collection('products').updateOne({ _id: new mongoose.Types.ObjectId(productId) }, { $set: { price: 999, name: 'Changed Product' } }));
  await page.reload();
  await expect(page.locator('.order-snapshot-item')).toContainText('Checkout Test Product');
  await expect(page.locator('.order-total')).toContainText('₹125.50');
  await page.getByRole('link', { name: 'View My Orders', exact: true }).click();
  await expect(page.locator('.order-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'View Details', exact: false }).click();
  await expect(page).toHaveURL(/\/orders\/[a-f0-9]{24}$/);
  await expect(page.getByText('Payment: PAID', { exact: true })).toBeVisible();
  await page.goto(successUrl); await expect(page.getByRole('heading', { name: 'Order Placed Successfully' })).toBeVisible();
});
test('simulated gateway: payment failure/cancel and verification retry preserve cart', async ({ page }) => {
  await start(page); await address(page);
  await page.getByRole('button', { name: 'Pay with Razorpay (Test)' }).click();
  await page.getByRole('button', { name: 'Fail simulated payment' }).click();
  await page.getByRole('button', { name: 'Cancel simulated payment' }).click();
  await expect(page.getByRole('alert')).toContainText('Payment cancelled');
  await expect(page.getByRole('link', { name: 'Cart (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pay with Razorpay (Test)' }).click();
  await page.route('**/api/orders/verify-payment', route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"message":"Temporary verification failure"}' }));
  await page.getByRole('button', { name: 'Complete simulated payment' }).click();
  await expect(page.getByRole('alert')).toContainText('do not pay again');
  await expect(page.getByRole('link', { name: 'Cart (1)', exact: true })).toBeVisible();
  await page.unroute('**/api/orders/verify-payment');
  await page.getByRole('button', { name: 'Retry payment verification' }).click();
  await expect(page.getByRole('heading', { name: 'Order Placed Successfully' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart (0)', exact: true })).toBeVisible();
  await page.goto('/orders/000000000000000000000000');
  await expect(page.getByRole('heading', { name: 'Order not found.' })).toBeVisible();
});

test('orders empty/loading/error/retry and checkout script/setup failures', async ({ page }) => {
  await start(page);
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'You have not placed any orders yet.' })).toBeVisible();
  await page.route('**/api/orders', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Temporary order history error"}' });
  });
  await page.reload();
  await expect(page.getByText('Loading your orders...', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Unable to load your orders');
  await page.unroute('**/api/orders');
  await page.getByRole('button', { name: 'Try Again' }).click();
  await expect(page.getByRole('heading', { name: 'You have not placed any orders yet.' })).toBeVisible();
  await page.goto('/checkout'); await address(page);
  await page.route('https://checkout.razorpay.com/v1/checkout.js', route => route.abort());
  await page.getByRole('button', { name: 'Pay with Razorpay (Test)' }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to load Razorpay Checkout');
  await expect(page.getByRole('link', { name: 'Cart (1)', exact: true })).toBeVisible();
  await page.unroute('https://checkout.razorpay.com/v1/checkout.js');
  await page.route('https://checkout.razorpay.com/v1/checkout.js', route => route.fulfill({ contentType: 'application/javascript', body: readFileSync(new URL('./fixtures/checkout-double.js', import.meta.url), 'utf8') }));
  await page.route('**/api/orders/create-payment-order', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Razorpay Test Mode keys are not configured on the backend"}' }));
  await page.getByRole('button', { name: 'Pay with Razorpay (Test)' }).click();
  await expect(page.getByRole('alert')).toContainText('Test Mode keys are not configured');
  await expect(page.getByRole('link', { name: 'Cart (1)', exact: true })).toBeVisible();
});
