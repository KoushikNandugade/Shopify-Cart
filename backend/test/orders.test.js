import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import app from '../app.js';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';

let server, base, cookie, otherCookie, product, extra, checkout, remoteCalls = 0, paymentMode = 'captured', remoteFailure = false;
const secret = crypto.randomBytes(32).toString('hex');
const remoteOrders = new Map();
const emails = [1, 2].map(i => `orders-${Date.now()}-${i}@example.com`);
const address = { fullName: 'Aarav Sharma', phone: '9876543210', addressLine1: '22 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' };
async function call(path, method = 'GET', body, session = cookie) {
  const response = await fetch(base + path, { method, headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(session && { Cookie: session }) }, ...(body !== undefined && { body: JSON.stringify(body) }) });
  const data = await response.json();
  assert.equal(JSON.stringify(data).includes(secret), false);
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
function verification(data = checkout, paymentId = 'pay_test_verified') {
  return { shopKartOrderId: data.shopKartOrderId, razorpay_order_id: data.razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: crypto.createHmac('sha256', secret).update(`${data.razorpayOrderId}|${paymentId}`).digest('hex') };
}
before(async () => {
  await mongoose.connect(process.env.MONGODB_URI); await Customer.init(); await Order.init();
  app.locals.paymentGateway = {
    keyId: 'rzp_test_isolated_unit_test', signingSecret: secret,
    createOrder: async options => {
      if (remoteFailure) throw new Error('Simulated gateway unavailable');
      const id = `order_isolated_${++remoteCalls}`; remoteOrders.set(id, options);
      return { id, ...options };
    },
    fetchPayment: async () => {
      if (paymentMode === 'unavailable') throw new Error('Simulated API failure');
      return { order_id: checkout.razorpayOrderId, amount: paymentMode === 'wrongAmount' ? 1 : checkout.amount, currency: 'INR', status: paymentMode === 'authorized' ? 'authorized' : paymentMode === 'failed' ? 'failed' : 'captured' };
    },
    capturePayment: async (_id, amount) => ({ status: 'captured', amount, order_id: checkout.razorpayOrderId, currency: 'INR' }),
  };
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  for (const email of emails) await call('/customers/register', 'POST', { fullName: 'Order Tester', email, password: 'orderpass123', phone: '9876543210' }, null);
  cookie = (await call('/customers/login', 'POST', { email: emails[0], password: 'orderpass123' }, null)).cookie;
  otherCookie = (await call('/customers/login', 'POST', { email: emails[1], password: 'orderpass123' }, null)).cookie;
  product = await Product.create({ name: 'Order Test Product', description: 'Test', price: 125.5, category: 'Test', image: '/product-images/book.svg', stock: 5 });
  extra = await Product.create({ name: 'Second Order Product', description: 'Test', price: 50, category: 'Test', image: '/product-images/mug.svg', stock: 2 });
});
after(async () => {
  const users = await Customer.find({ email: { $in: emails } });
  await Order.deleteMany({ user: { $in: users.map(user => user._id) } });
  await Customer.deleteMany({ email: { $in: emails } });
  await Product.deleteMany({ _id: { $in: [product?._id, extra?._id].filter(Boolean) } });
  delete app.locals.paymentGateway;
  if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect();
});

test('orders protect ownership, validate shipping and reject empty carts', async () => {
  for (const [path, method] of [['/orders', 'GET'], ['/orders/000000000000000000000000', 'GET'], ['/orders/create-payment-order', 'POST'], ['/orders/verify-payment', 'POST']]) assert.equal((await call(path, method, method === 'GET' ? undefined : {}, null)).status, 401);
  for (const field of Object.keys(address)) {
    const shipping = { ...address, [field]: ' ' };
    assert.equal((await call('/orders/create-payment-order', 'POST', { shippingAddress: shipping })).status, 400);
  }
  for (const values of [{ phone: 'abc' }, { pincode: '12345' }, { pincode: '000000' }, { fullName: { bad: true } }]) assert.equal((await call('/orders/create-payment-order', 'POST', { shippingAddress: { ...address, ...values } })).status, 400);
  assert.equal((await call('/orders/create-payment-order', 'POST', { shippingAddress: address })).status, 400);
  assert.equal((await call('/orders/invalid')).status, 400);
  assert.deepEqual((await call('/orders')).data.orders, []);
});
test('checkout revalidates stock, ignores fake totals, snapshots and reuses pending orders', async () => {
  await call(`/cart/${product.id}`, 'POST'); await call(`/cart/${product.id}`, 'POST'); await call(`/cart/${extra.id}`, 'POST');
  await Product.updateOne({ _id: product._id }, { $set: { stock: 1 } });
  const insufficient = await call('/orders/create-payment-order', 'POST', { shippingAddress: address });
  assert.equal(insufficient.status, 400); assert.match(insufficient.data.message, /Insufficient stock/);
  await Product.updateOne({ _id: product._id }, { $set: { stock: 5 } });
  const created = await call('/orders/create-payment-order', 'POST', { shippingAddress: address, totalAmount: 1, items: [] });
  assert.equal(created.status, 201); checkout = created.data;
  assert.equal(checkout.amount, 30100); assert.equal(checkout.currency, 'INR');
  assert.equal(remoteOrders.get(checkout.razorpayOrderId).amount, 30100);
  assert.equal((await call('/cart')).data.cart.length, 2);
  const repeat = await call('/orders/create-payment-order', 'POST', { shippingAddress: address });
  assert.equal(repeat.data.shopKartOrderId, checkout.shopKartOrderId); assert.equal(remoteCalls, 1);
  const pending = await call(`/orders/${checkout.shopKartOrderId}`);
  assert.equal(pending.data.order.paymentStatus, 'PENDING'); assert.equal(pending.data.order.totalAmount, 301);
  assert.equal(pending.data.order.checkoutKey, undefined); assert.equal(pending.data.order.cartVersion, undefined);
  assert.equal((await call(`/orders/${checkout.shopKartOrderId}`, 'GET', undefined, otherCookie)).status, 404);
  assert.equal((await call('/orders/verify-payment', 'POST', verification(), otherCookie)).status, 404);
});
test('invalid signature, mismatched payment and provider failures never clear the cart', async () => {
  assert.equal((await call('/orders/verify-payment', 'POST', { ...verification(), razorpay_signature: '0'.repeat(64) })).status, 400);
  assert.equal((await call('/orders/verify-payment', 'POST', { ...verification(), razorpay_order_id: 'order_not_trusted' })).status, 400);
  for (const [mode, status] of [['wrongAmount', 400], ['unavailable', 502], ['failed', 409]]) {
    paymentMode = mode; assert.equal((await call('/orders/verify-payment', 'POST', verification())).status, status);
    assert.equal((await call('/cart')).data.cart.length, 2);
    assert.equal((await Order.findById(checkout.shopKartOrderId)).paymentStatus, 'PENDING');
  }
});
test('verified captured payment places the order, clears cart once and keeps historical snapshots', async () => {
  paymentMode = 'authorized';
  const result = await call('/orders/verify-payment', 'POST', verification());
  assert.equal(result.status, 200); assert.equal(result.data.order.paymentStatus, 'PAID'); assert.equal(result.data.order.status, 'PLACED');
  assert.equal(result.data.order.razorpayPaymentId, 'pay_test_verified');
  assert.deepEqual((await call('/cart')).data.cart, []);
  await call(`/cart/${extra.id}`, 'POST');
  assert.equal((await call('/orders/verify-payment', 'POST', verification())).status, 200);
  assert.equal((await call('/cart')).data.cart.length, 1); // Replay must not erase a new cart.
  await Product.updateOne({ _id: product._id }, { $set: { price: 999, name: 'Changed Name' } });
  await Product.deleteOne({ _id: product._id });
  const historical = (await call(`/orders/${checkout.shopKartOrderId}`)).data.order;
  assert.equal(historical.items[0].price, 125.5); assert.equal(historical.items[0].name, 'Order Test Product'); assert.equal(historical.totalAmount, 301);
  assert.equal((await call('/orders')).data.orders.length, 1);
  assert.equal((await call('/orders', 'GET', undefined, otherCookie)).data.orders.length, 0);
});
test('gateway setup failure and missing credentials preserve cart; failed setup can retry', async () => {
  remoteFailure = true;
  assert.equal((await call('/orders/create-payment-order', 'POST', { shippingAddress: address })).status, 502);
  assert.equal((await call('/cart')).data.cart.length, 1);
  remoteFailure = false;
  assert.equal((await call('/orders/create-payment-order', 'POST', { shippingAddress: address })).status, 201);
  const gateway = app.locals.paymentGateway; delete app.locals.paymentGateway;
  const oldId = process.env.RAZORPAY_KEY_ID; const oldSecret = process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET;
  try { assert.equal((await call('/orders/create-payment-order', 'POST', { shippingAddress: address })).status, 503); }
  finally {
    if (oldId !== undefined) process.env.RAZORPAY_KEY_ID = oldId;
    if (oldSecret !== undefined) process.env.RAZORPAY_KEY_SECRET = oldSecret;
    app.locals.paymentGateway = gateway;
  }
  assert.equal((await call('/cart')).data.cart.length, 1);
});
