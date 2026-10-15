import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../app.js';
import Product from '../models/product.model.js';

let server, base;
const category = `Test-${Date.now()}`;
const sample = { name: 'Test Keyboard [Pro]', description: 'A test product', price: 100, category, image: 'https://example.com/keyboard.jpg', stock: 3 };
const ids = [];
async function call(path = '', method = 'GET', body) {
  const response = await fetch(`${base}/products${path}`, { method, ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
before(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await Product.deleteMany({ _id: { $in: ids } });
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
});
test('product creation enforces required fields and numeric constraints', async () => {
  for (const field of Object.keys(sample)) {
    const body = { ...sample }; delete body[field];
    assert.equal((await call('', 'POST', body)).status, 400, field);
  }
  for (const body of [{ price: 0 }, { price: -1 }, { price: '100' }, { stock: -1 }, { stock: 1.5 }, { image: 'javascript:alert(1)' }, { name: ' ' }]) {
    assert.equal((await call('', 'POST', { ...sample, ...body })).status, 400);
  }
  for (const [name, price, stock] of [[sample.name, 100, 3], ['Test Mouse', 50, 0]]) {
    const { status, data } = await call('', 'POST', { ...sample, name, price, stock });
    if (data.product) ids.push(data.product._id);
    assert.equal(status, 201);
    assert.ok(data.product.createdAt);
    assert.equal(data.product.__v, undefined);
  }
  assert.equal(await Product.countDocuments({ _id: { $in: ids } }), 2);
});
test('listing, literal case-insensitive search, combined filters, sorting and detail errors', async () => {
  const query = `?category=${encodeURIComponent(category)}`;
  const all = await call(query);
  assert.equal(all.data.count, 2);
  assert.equal(all.data.products.length, 2);
  const found = await call(`${query}&search=KEYBOARD`);
  assert.equal(found.data.count, 1);
  assert.equal((await call(`${query}&search=${encodeURIComponent('[Pro]')}`)).data.count, 1);
  assert.equal((await call(`${query}&search=nonexistent`)).data.count, 0);
  assert.equal((await call('?search=Keyboard&category=not-a-category')).data.count, 0);
  assert.deepEqual((await call(`${query}&sort=price_asc`)).data.products.map(p => p.price), [50, 100]);
  assert.deepEqual((await call(`${query}&sort=price_desc`)).data.products.map(p => p.price), [100, 50]);
  assert.equal((await call('?sort=unknown')).status, 400);
  assert.equal((await call('?search[x]=bad')).status, 200); // Express simple query parser treats it as an unrelated key.
  assert.equal((await call('?search=a&search=b')).status, 400);
  const one = await call(`/${ids[0]}`);
  assert.equal(one.status, 200);
  assert.equal(one.data.product.description, sample.description);
  assert.equal((await call('/invalid')).status, 400);
  assert.equal((await call('/000000000000000000000000')).status, 404);
});
