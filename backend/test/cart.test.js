import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import app from '../app.js';

let server, base, a, b, product, second;
const emails = [1, 2].map(i => `cart-${Date.now()}-${i}@example.com`);
async function call(path, method = 'GET', body, cookie) {
  const response = await fetch(base + path, { method, headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
  const data = await response.json();
  assert.equal(JSON.stringify(data).includes('"password"'), false);
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
before(async () => {
  await mongoose.connect(process.env.MONGODB_URI); await Customer.init();
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const email of emails) await call('/customers/register', 'POST', { fullName: 'Cart Tester', email, password: 'cartpass123', phone: '9876543210' });
  a = (await call('/customers/login', 'POST', { email: emails[0], password: 'cartpass123' })).cookie;
  b = (await call('/customers/login', 'POST', { email: emails[1], password: 'cartpass123' })).cookie;
  product = await Product.create({ name: 'Cart Test Product', description: 'Test', price: 100.25, category: 'Test', image: '/product-images/book.svg', stock: 5 });
  second = await Product.create({ name: 'Other Cart Product', description: 'Test', price: 50, category: 'Test', image: '/product-images/mug.svg', stock: 1 });
});
after(async () => {
  await Customer.deleteMany({ email: { $in: emails } });
  await Product.deleteMany({ _id: { $in: [product?._id, second?._id].filter(Boolean) } });
  if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect();
});

test('cart authentication, ID validation, quantity validation and missing products', async () => {
  for (const [method, path] of [['GET', '/cart'], ...['POST', 'PATCH', 'DELETE'].map(method => [method, `/cart/${product.id}`])]) {
    assert.equal((await call(path, method)).status, 401);
    assert.equal((await call(path, method, undefined, 'shopkart_token=bad')).status, 401);
  }
  for (const method of ['POST', 'PATCH', 'DELETE']) assert.equal((await call('/cart/invalid', method, { quantity: 1 }, a)).status, 400);
  assert.equal((await call('/cart/000000000000000000000000', 'POST', undefined, a)).status, 404);
  assert.equal((await call(`/cart/${product.id}`, 'PATCH', { quantity: 1 }, a)).status, 404);
  assert.equal((await call(`/cart/${product.id}`, 'DELETE', undefined, a)).status, 404);
  for (const quantity of [0, -1, 1.5, '2', null, {}, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await call(`/cart/${product.id}`, 'PATCH', { quantity }, a)).status, 400);
  }
  assert.equal((await call(`/cart/${product.id}`, 'PATCH', {}, a)).status, 400);
  assert.deepEqual((await call('/cart', 'GET', undefined, a)).data.cart, []);
});

test('concurrent adds increment one row, enforce stock, and cannot select another customer', async () => {
  const other = await Customer.findOne({ email: emails[1] });
  const added = await Promise.all(Array.from({ length: 7 }, () => call(`/cart/${product.id}`, 'POST', { userId: other.id }, a)));
  assert.equal(added.filter(result => result.status === 200).length, 5);
  assert.equal(added.filter(result => result.status === 400).length, 2);
  const cart = (await call('/cart', 'GET', undefined, a)).data.cart;
  assert.equal(cart.length, 1); assert.equal(cart[0].quantity, 5);
  assert.equal(cart[0].product.price, 100.25);
  const raw = await Customer.findOne({ email: emails[0] }).lean();
  assert.ok(raw.cart[0].product instanceof mongoose.Types.ObjectId);
  assert.equal(raw.cart[0].price, undefined); assert.equal(raw.subtotal, undefined);
  assert.deepEqual((await call('/cart', 'GET', undefined, b)).data.cart, []);
  assert.equal((await call(`/cart/${product.id}`, 'DELETE', undefined, b)).status, 404);
  assert.equal((await call(`/cart/${other.id}`, 'GET', undefined, a)).status, 404);
  assert.equal((await call(`/cart?userId=${other.id}`, 'GET', undefined, a)).data.cart.length, 1);
  assert.equal((await call(`/cart/${product.id}`, 'PATCH', { quantity: 6 }, a)).status, 400);
  const changed = await call(`/cart/${product.id}`, 'PATCH', { quantity: 2 }, a);
  assert.equal(changed.data.cart[0].quantity, 2);
  await call(`/cart/${second.id}`, 'POST', undefined, a);
  assert.equal((await call('/cart', 'GET', undefined, a)).data.cart.length, 2);
});

test('live price and stock, login persistence, legacy defaults and deleted products', async () => {
  await Product.updateOne({ _id: product._id }, { $set: { price: 120.5, stock: 1 } });
  const current = (await call('/cart', 'GET', undefined, a)).data.cart.find(item => item.product._id === product.id);
  assert.equal(current.product.price, 120.5); assert.equal(current.product.stock, 1);
  assert.equal((await call(`/cart/${product.id}`, 'POST', undefined, a)).status, 400);
  assert.equal((await call(`/cart/${product.id}`, 'PATCH', { quantity: 2 }, a)).status, 400);
  assert.equal((await call(`/cart/${product.id}`, 'PATCH', { quantity: 1 }, a)).status, 200);
  await call('/customers/logout', 'POST', undefined, a);
  a = (await call('/customers/login', 'POST', { email: emails[0], password: 'cartpass123' })).cookie;
  assert.equal((await call('/cart', 'GET', undefined, a)).data.cart.length, 2);
  await Product.updateOne({ _id: product._id }, { $set: { stock: 0 } });
  assert.equal((await call(`/cart/${product.id}`, 'POST', undefined, a)).status, 400);
  const removed = await call(`/cart/${product.id}`, 'DELETE', undefined, a);
  assert.equal(removed.status, 200); assert.equal(removed.data.cart.length, 1);
  await Product.deleteOne({ _id: second._id });
  const missing = await call('/cart', 'GET', undefined, a);
  assert.deepEqual(missing.data.cart, []); assert.deepEqual(missing.data.unavailableProductIds, [second.id]);
  assert.equal((await call(`/cart/${second.id}`, 'DELETE', undefined, a)).status, 200);
  await Customer.collection.updateOne({ email: emails[0] }, { $unset: { cart: '', cartVersion: '' } });
  await Product.updateOne({ _id: product._id }, { $set: { stock: 2 } });
  assert.deepEqual((await call('/cart', 'GET', undefined, a)).data.cart, []);
  assert.equal((await call(`/cart/${product.id}`, 'POST', undefined, a)).status, 200);
});
