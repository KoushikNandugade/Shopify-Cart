import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  image: String,
}, { _id: false });
const shippingSchema = new mongoose.Schema(Object.fromEntries(
  ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'].map(key => [key, { type: String, required: true, trim: true }]),
), { _id: false });
const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  items: { type: [itemSchema], required: true, validate: value => value.length > 0 },
  shippingAddress: { type: shippingSchema, required: true },
  totalAmount: { type: Number, required: true, min: 0.01 },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' },
  status: { type: String, enum: ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'], default: 'PENDING_PAYMENT' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  checkoutKey: { type: String, required: true, unique: true, select: false },
  setupStatus: { type: String, enum: ['CREATING', 'READY', 'FAILED'], default: 'CREATING', select: false },
  cartVersion: { type: Number, required: true, select: false },
  cartCleared: { type: Boolean, default: false, select: false },
}, { timestamps: true });
export default mongoose.model('Order', orderSchema);
