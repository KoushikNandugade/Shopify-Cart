import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, required: true, trim: true },
  wishlist: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  cart: { type: [new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1, min: 1, required: true, validate: Number.isSafeInteger },
  }, { _id: false })], default: [] },
  cartVersion: { type: Number, default: 0, select: false },
  // Incrementing this invalidates previously issued tokens after a password change.
  tokenVersion: { type: Number, default: 0, select: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.model('Customer', customerSchema);

export function publicCustomer(customer) {
  return {
    _id: customer._id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
  };
}
