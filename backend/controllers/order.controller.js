import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import { paymentGateway } from '../config/razorpay.js';

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const publicFields = '-__v'; // Sensitive workflow fields have select:false in the schema.
function shippingAddress(body) {
  const result = {};
  for (const field of ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode']) {
    const value = body?.[field];
    if (typeof value !== 'string' || !value.trim() || value.length > 200) return null;
    result[field] = value.trim();
  }
  if (!/^\+?[1-9]\d{9,14}$/.test(result.phone) || !/^[1-9]\d{5}$/.test(result.pincode)) return null;
  return result;
}
function gatewayOrError(req, res) {
  try { return paymentGateway(req.app); }
  catch (error) { fail(res, 503, error.message); return null; }
}

export async function createPaymentOrder(req, res) {
  const address = shippingAddress(req.body?.shippingAddress);
  if (!address) return fail(res, 400, 'All shipping fields are required; phone must be 10–15 digits with optional +, and pincode must be 6 digits starting 1–9');
  const customer = await Customer.findById(req.user._id).select('cart +cartVersion').lean();
  if (!customer) return fail(res, 401, 'Unauthorized');
  if (!customer.cart?.length) return fail(res, 400, 'Your cart is empty');
  const products = await Product.find({ _id: { $in: customer.cart.map(item => item.product) } }).lean();
  const items = [];
  let amount = 0;
  for (const item of customer.cart) {
    const product = products.find(product => product._id.equals(item.product));
    if (!product) return fail(res, 400, 'A product in your cart is no longer available. Please review your cart.');
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > product.stock) return fail(res, 400, `Insufficient stock for ${product.name}`);
    const unitPaise = Math.round(product.price * 100);
    if (!Number.isSafeInteger(unitPaise) || unitPaise <= 0) return fail(res, 400, 'Invalid product price');
    amount += unitPaise * item.quantity;
    items.push({ product: product._id, name: product.name, price: unitPaise / 100, quantity: item.quantity, image: product.image });
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) return fail(res, 400, 'Invalid order total');
  const gateway = gatewayOrError(req, res);
  if (!gateway) return;
  const checkoutKey = crypto.createHash('sha256').update(JSON.stringify({ user: customer._id, version: customer.cartVersion ?? 0, address, items })).digest('hex');
  let order = await Order.findOne({ checkoutKey }).select('+setupStatus');
  let createRemote = false;
  if (!order) {
    try {
      order = await Order.create({ user: customer._id, items, shippingAddress: address, totalAmount: amount / 100, cartVersion: customer.cartVersion ?? 0, checkoutKey });
      createRemote = true;
    } catch (error) {
      if (error.code === 11000) return fail(res, 409, 'Payment order is being prepared. Please retry shortly.');
      throw error;
    }
  } else if (order.paymentStatus === 'PAID') return fail(res, 409, 'This order has already been paid. Check My Orders.');
  else if (order.setupStatus === 'FAILED') {
    createRemote = !!(await Order.findOneAndUpdate({ _id: order._id, setupStatus: 'FAILED' }, { $set: { setupStatus: 'CREATING', paymentStatus: 'PENDING' } }));
  }
  if (createRemote) {
    try {
      const remote = await gateway.createOrder({ amount, currency: 'INR', receipt: order._id.toString() });
      if (!remote.id || Number(remote.amount) !== amount || remote.currency !== 'INR') throw new Error('Unexpected payment order');
      await Order.updateOne({ _id: order._id }, { $set: { razorpayOrderId: remote.id, setupStatus: 'READY' } });
      order.razorpayOrderId = remote.id;
    } catch {
      await Order.updateOne({ _id: order._id }, { $set: { setupStatus: 'FAILED', paymentStatus: 'FAILED' } });
      return fail(res, 502, 'Unable to create Razorpay order. Your cart is unchanged. Please try again.');
    }
  }
  if (!order.razorpayOrderId) return fail(res, 409, 'Payment order is being prepared. Please retry shortly.');
  return res.status(201).json({ success: true, shopKartOrderId: order._id, razorpayOrderId: order.razorpayOrderId, amount, currency: 'INR', key: gateway.keyId });
}

export async function verifyPayment(req, res) {
  const { shopKartOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
  if (!mongoose.isObjectIdOrHexString(shopKartOrderId) || ![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(value => typeof value === 'string' && value.length < 300) || !/^[a-f0-9]{64}$/i.test(razorpay_signature)) {
    return fail(res, 400, 'Invalid payment verification data');
  }
  let order = await Order.findOne({ _id: shopKartOrderId, user: req.user._id }).select('+cartVersion +cartCleared');
  if (!order) return fail(res, 404, 'Order not found');
  const gateway = gatewayOrError(req, res);
  if (!gateway) return;
  if (!order.razorpayOrderId || order.razorpayOrderId !== razorpay_order_id) return fail(res, 400, 'Payment order mismatch');
  const expected = crypto.createHmac('sha256', gateway.signingSecret).update(`${order.razorpayOrderId}|${razorpay_payment_id}`).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(razorpay_signature, 'hex'))) return fail(res, 400, 'Invalid payment signature');
  if (order.paymentStatus === 'PAID' && order.razorpayPaymentId !== razorpay_payment_id) return fail(res, 409, 'Order already paid with another payment');
  if (order.paymentStatus !== 'PAID') {
    let payment;
    try {
      payment = await gateway.fetchPayment(razorpay_payment_id);
      const amount = Math.round(order.totalAmount * 100);
      if (payment.order_id !== order.razorpayOrderId || Number(payment.amount) !== amount || payment.currency !== 'INR') return fail(res, 400, 'Payment details do not match this order');
      if (payment.status === 'authorized') payment = await gateway.capturePayment(razorpay_payment_id, amount);
      if (payment.status !== 'captured') return fail(res, 409, 'Payment is not captured yet. Retry verification; do not pay again.');
    } catch { return fail(res, 502, 'Unable to confirm payment with Razorpay. Retry verification; do not pay again.'); }
    const updated = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: { $ne: 'PAID' } }, { $set: { paymentStatus: 'PAID', status: 'PLACED', razorpayPaymentId: razorpay_payment_id } }, { new: true }).select('+cartVersion +cartCleared');
    order = updated ?? await Order.findById(order._id).select('+cartVersion +cartCleared');
    if (order.razorpayPaymentId !== razorpay_payment_id) return fail(res, 409, 'Order already paid with another payment');
  }
  if (!order.cartCleared) {
    // Idempotent cleanup. A retried verification must not clear a newly built cart.
    const version = order.cartVersion;
    await Customer.updateOne({ _id: req.user._id, ...(version === 0 ? { $or: [{ cartVersion: 0 }, { cartVersion: { $exists: false } }] } : { cartVersion: version }) }, { $set: { cart: [] }, $inc: { cartVersion: 1 } });
    await Order.updateOne({ _id: order._id }, { $set: { cartCleared: true } });
  }
  return res.json({ success: true, message: 'Payment verified. Order placed successfully.', order: await Order.findById(order._id).select(publicFields) });
}

export async function getOrders(req, res) {
  const orders = await Order.find({ user: req.user._id }).select(publicFields).sort({ createdAt: -1, _id: -1 }).lean();
  return res.json({ success: true, orders });
}
export async function getOrder(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return fail(res, 400, 'Invalid order ID');
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).select(publicFields).lean();
  if (!order) return fail(res, 404, 'Order not found');
  return res.json({ success: true, order });
}
