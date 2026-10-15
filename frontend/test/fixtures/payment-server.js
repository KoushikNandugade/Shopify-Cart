// Isolated Playwright gateway double. Never imported by the application server.
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import app from '../../../backend/app.js';
import Order from '../../../backend/models/order.model.js';
const requireBackend = createRequire(new URL('../../../backend/package.json', import.meta.url));
const mongoose = requireBackend('mongoose');
const secret = crypto.randomBytes(32).toString('hex');
const orders = new Map();
const payments = new Map();
app.locals.paymentGateway = {
  keyId: 'rzp_test_playwright_simulation', signingSecret: secret,
  createOrder: async data => { const id = `order_simulated_${crypto.randomBytes(8).toString('hex')}`; orders.set(id, data); return { id, ...data }; },
  fetchPayment: async id => { if (!payments.has(id)) throw new Error('Unknown simulated payment'); return payments.get(id); },
  capturePayment: async id => ({ ...payments.get(id), status: 'captured' }),
};
// Registered after app's 404 handler via a separate tiny Express parent.
const express = requireBackend('express');
const parent = express();
parent.use(express.json());
parent.get('/__test/health', (_req, res) => res.json({ simulation: true }));
parent.post('/__test/pay', (req, res) => {
  const order = orders.get(req.body.orderId);
  if (!order) return res.status(404).json({ message: 'Unknown simulated order' });
  const paymentId = `pay_simulated_${crypto.randomBytes(8).toString('hex')}`;
  payments.set(paymentId, { order_id: req.body.orderId, amount: order.amount, currency: 'INR', status: 'captured' });
  res.json({ razorpay_order_id: req.body.orderId, razorpay_payment_id: paymentId, razorpay_signature: crypto.createHmac('sha256', secret).update(`${req.body.orderId}|${paymentId}`).digest('hex') });
});
parent.use(app);
await mongoose.connect(process.env.MONGODB_URI); await Order.init();
const server = parent.listen(5001, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(async () => { await mongoose.disconnect(); process.exit(0); }));
