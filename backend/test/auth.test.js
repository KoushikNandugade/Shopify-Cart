import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import Customer from '../models/customer.model.js';

let server, base;
const email = `lab-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
const user = { fullName: 'Lab Customer', email, password: 'john123', phone: '9876543210' };
async function request(path, method = 'GET', body, cookie) {
  const response = await fetch(`${base}/customers${path}`, {
    method, headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  assert.equal(JSON.stringify(data).includes('"password"'), false);
  return { response, data };
}
before(async () => {
  assert.ok(process.env.JWT_SECRET, 'JWT_SECRET must be configured');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Customer.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (mongoose.connection.readyState === 1) await Customer.deleteOne({ email });
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
});

test('registration validation, unique email and bcrypt storage', async () => {
  for (const field of ['fullName', 'email', 'password', 'phone']) {
    const body = { ...user }; delete body[field];
    assert.equal((await request('/register', 'POST', body)).response.status, 400);
  }
  assert.equal((await request('/register', 'POST', { ...user, password: 'short' })).response.status, 400);
  assert.equal((await request('/register', 'POST', { ...user, password: 'x'.repeat(73) })).response.status, 400);
  assert.equal((await request('/register', 'POST', { ...user, email: { $ne: null } })).response.status, 400);
  const { response, data } = await request('/register', 'POST', user);
  assert.equal(response.status, 201);
  assert.equal(data.customer.email, email);
  assert.equal((await request('/register', 'POST', { ...user, email: email.toUpperCase() })).response.status, 409);
  const saved = await Customer.findOne({ email }).select('+password');
  assert.notEqual(saved.password, user.password);
  assert.equal(await bcrypt.compare(user.password, saved.password), true);
});

test('cookie authentication, protected routes, password change and logout', async () => {
  assert.equal((await request('/me')).response.status, 401);
  assert.equal((await request('/logout', 'POST')).response.status, 401);
  assert.equal((await request('/me', 'GET', undefined, 'shopkart_token=bad')).response.status, 401);
  const wrong = await request('/login', 'POST', { email, password: 'wrong' });
  const missing = await request('/login', 'POST', { email: `missing-${email}`, password: 'wrong' });
  assert.equal(wrong.response.status, 401);
  assert.deepEqual(wrong.data, missing.data);
  const login = await request('/login', 'POST', user);
  assert.equal(login.response.status, 200);
  const header = login.response.headers.get('set-cookie');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Strict/i);
  const cookie = header.split(';')[0];
  const payload = jwt.verify(decodeURIComponent(cookie.split('=')[1]), process.env.JWT_SECRET);
  assert.ok(payload.sub);
  assert.ok(payload.exp);
  const me = await request('/me', 'GET', undefined, cookie);
  assert.equal(me.response.status, 200);
  assert.equal(me.data.email, email);
  const expired = jwt.sign({ version: 0 }, process.env.JWT_SECRET, { subject: payload.sub, expiresIn: -1 });
  assert.equal((await request('/me', 'GET', undefined, `shopkart_token=${expired}`)).response.status, 401);
  assert.equal((await request('/change-password', 'PATCH', { oldPassword: 'wrong', newPassword: 'newpass123' }, cookie)).response.status, 401);
  assert.equal((await request('/change-password', 'PATCH', { oldPassword: user.password, newPassword: '123' }, cookie)).response.status, 400);
  assert.equal((await request('/change-password', 'PATCH', { oldPassword: user.password, newPassword: 'newpass123' }, cookie)).response.status, 200);
  assert.equal((await request('/me', 'GET', undefined, cookie)).response.status, 401);
  assert.equal((await request('/login', 'POST', user)).response.status, 401);
  const fresh = await request('/login', 'POST', { email, password: 'newpass123' });
  assert.equal(fresh.response.status, 200);
  const freshCookie = fresh.response.headers.get('set-cookie').split(';')[0];
  const logout = await request('/logout', 'POST', undefined, freshCookie);
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get('set-cookie'), /shopkart_token=;/);
  assert.match(logout.response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await request('/me')).response.status, 401);
});
