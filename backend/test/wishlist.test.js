import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../app.js';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';

let server, base, a, b, product, second;
const emails = [1, 2].map(i => `wishlist-${Date.now()}-${i}@example.com`);
async function call(path, method = 'GET', body, cookie) {
  const response = await fetch(base + path, { method, headers: { ...(body && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) }, ...(body && { body: JSON.stringify(body) }) });
  const data = await response.json();
  assert.equal(JSON.stringify(data).includes('"password"'), false);
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await Customer.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const email of emails) await call('/customers/register', 'POST', { fullName: 'Wishlist Tester', email, password: 'labpass123', phone: '9876543210' });
  a = (await call('/customers/login', 'POST', { email: emails[0], password: 'labpass123' })).cookie;
  b = (await call('/customers/login', 'POST', { email: emails[1], password: 'labpass123' })).cookie;
  product = await Product.create({ name: 'Wishlist Test Product', description: 'Test', price: 100, category: 'Test', image: 'https://example.com/test.jpg', stock: 0 });
  second = await Product.create({ name: 'Deleted Test Product', description: 'Test', price: 50, category: 'Test', image: 'https://example.com/test.jpg', stock: 2 });
});
after(async () => {
  await Customer.deleteMany({ email: { $in: emails } });
  await Product.deleteMany({ _id: { $in: [product?._id, second?._id].filter(Boolean) } });
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
});

test('wishlist is protected and validates product IDs', async () => {
  for (const [path, method] of [['/wishlist', 'GET'], [`/wishlist/${product.id}`, 'POST'], [`/wishlist/${product.id}`, 'DELETE']]) {
    assert.equal((await call(path, method)).status, 401);
    assert.equal((await call(path, method, undefined, 'shopkart_token=invalid')).status, 401);
  }
  for (const method of ['POST', 'DELETE']) assert.equal((await call('/wishlist/invalid', method, undefined, a)).status, 400);
  assert.equal((await call('/wishlist/000000000000000000000000', 'POST', undefined, a)).status, 404);
  assert.equal((await call(`/wishlist/${product.id}`, 'DELETE', undefined, a)).status, 404);
  assert.equal((await call('/wishlist', 'GET', undefined, a)).data.count, 0);
});

test('atomic duplicate prevention, populated live products, account isolation and persistence', async () => {
  const other = await Customer.findOne({ email: emails[1] });
  const results = await Promise.all(Array.from({ length: 5 }, () => call(`/wishlist/${product.id}`, 'POST', { userId: other.id }, a)));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409, 409, 409, 409]);
  const saved = await Customer.findOne({ email: emails[0] }).lean();
  assert.equal(saved.wishlist.length, 1);
  assert.ok(saved.wishlist[0] instanceof mongoose.Types.ObjectId);
  assert.equal(saved.wishlist[0].toString(), product.id);
  assert.equal((await call('/wishlist', 'GET', undefined, b)).data.count, 0);
  assert.equal((await call(`/wishlist/${product.id}`, 'DELETE', undefined, b)).status, 404);
  assert.equal((await call(`/wishlist/${other.id}`, 'GET', undefined, a)).status, 404);
  const list = await call(`/wishlist?userId=${other.id}`, 'GET', undefined, a);
  assert.equal(list.data.count, 1); // A supplied userId cannot select another owner.
  assert.equal(list.data.wishlist[0].name, product.name);
  assert.equal(list.data.wishlist[0].description, undefined);
  await Product.updateOne({ _id: product._id }, { $set: { price: 125, stock: 10 } });
  const live = (await call('/wishlist', 'GET', undefined, a)).data.wishlist[0];
  assert.equal(live.price, 125); assert.equal(live.stock, 10);
  await call('/customers/logout', 'POST', undefined, a);
  a = (await call('/customers/login', 'POST', { email: emails[0], password: 'labpass123' })).cookie;
  assert.equal((await call('/wishlist', 'GET', undefined, a)).data.count, 1);
  assert.equal((await call(`/wishlist/${product.id}`, 'DELETE', undefined, a)).status, 200);
  assert.equal((await call(`/wishlist/${product.id}`, 'DELETE', undefined, a)).status, 404);
  assert.deepEqual((await call('/wishlist', 'GET', undefined, a)).data.wishlist, []);
});

test('legacy customers and dangling product references are handled', async () => {
  const customer = await Customer.findOne({ email: emails[0] });
  await Customer.collection.updateOne({ _id: customer._id }, { $unset: { wishlist: '' } });
  assert.equal((await call('/wishlist', 'GET', undefined, a)).data.count, 0);
  assert.equal((await call(`/wishlist/${second.id}`, 'POST', undefined, a)).status, 201);
  await Product.deleteOne({ _id: second._id });
  assert.equal((await call('/wishlist', 'GET', undefined, a)).data.count, 0);
  assert.equal((await call(`/wishlist/${second.id}`, 'DELETE', undefined, a)).status, 200);
});
