import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { readFileSync } from 'node:fs';
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const mongoose = requireBackend('mongoose');
async function database(task) {
  const env = parseEnv(readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8'));
  const db = await mongoose.createConnection(env.MONGODB_URI).asPromise();
  try { return await task(db); } finally { await db.close(); }
}

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`all pages responsive at ${width}px`, async ({ page, request }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    const email = `responsive-${width}-${Date.now()}@example.com`;
    let userId, orderId;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function check(path, ready) {
      await page.goto(path);
      await expect(page.locator(ready).first()).toBeVisible();
      const problems = await page.evaluate(() => {
        const issues = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) issues.push(`page width ${document.documentElement.scrollWidth} > ${innerWidth}`);
        for (const el of document.querySelectorAll('a,button,input,select')) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
          if (r.left < -1 || r.right > innerWidth + 1) issues.push(`${el.tagName} outside viewport: ${el.textContent?.trim().slice(0,35) || el.getAttribute('name')}`);
          if (el.tagName === 'BUTTON' && r.width < 24) issues.push(`button squeezed to ${r.width}: ${el.textContent.trim()}`);
          if (el.tagName === 'INPUT' && r.width < 100) issues.push(`input squeezed: ${el.name}`);
        }
        return issues;
      });
      expect(problems, `${width}px ${path}`).toEqual([]);
      if ([320, 768, 1440].includes(width)) await page.screenshot({ path: `/tmp/shopkart-audit-${width}-${path.replaceAll('/', '-').slice(1) || 'root'}.png`, fullPage: true });
    }
    try {
      await check('/login', 'form[aria-label="Log in"]');
      await check('/register', 'form[aria-label="Create account"]');
      expect((await request.post('http://127.0.0.1:5000/customers/register', { data: { fullName: 'Responsive Customer', email, password: 'responsive123', phone: '9876543210' } })).status()).toBe(201);
      await database(async db => {
        const user = await db.collection('customers').findOne({ email }); userId = user._id;
        const ids = ['530000000000000000000001', '530000000000000000000004'].map(id => new mongoose.Types.ObjectId(id));
        await db.collection('customers').updateOne({ _id: userId }, { $set: { wishlist: ids, cart: ids.map(product => ({ product, quantity: 1 })) } });
        const result = await db.collection('orders').insertOne({ user: userId, items: [{ product: ids[0], name: 'Historical Headphones', price: 4999, quantity: 1, image: '/product-images/headphones.svg' }], shippingAddress: { fullName: 'Responsive Customer', phone: '9876543210', addressLine1: '22 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' }, totalAmount: 4999, status: 'PLACED', paymentStatus: 'PAID', checkoutKey: `responsive-fixture-${email}`, createdAt: new Date(), updatedAt: new Date() });
        orderId = result.insertedId.toString();
      });
      await page.goto('/login');
      await page.getByLabel('Email address', { exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill('responsive123');
      await page.getByRole('button', { name: 'Log in', exact: true }).click();
      await expect(page).toHaveURL(/\/home$/);
      await check('/home', '.profile-card');
      await check('/products', '.product-card');
      await check('/products/530000000000000000000001', '.detail-copy');
      await check('/wishlist', '.product-card');
      await check('/cart', '.cart-item');
      await check('/checkout', '.shipping-form');
      await check('/orders', '.order-card');
      await check(`/orders/${orderId}`, '.order-detail-layout');
      await check(`/order-success/${orderId}`, '.order-detail-layout');
      expect(errors).toEqual([]);
    } finally {
      await database(async db => {
        if (userId) await db.collection('orders').deleteMany({ user: userId });
        await db.collection('customers').deleteOne({ email });
      });
    }
  });
}
