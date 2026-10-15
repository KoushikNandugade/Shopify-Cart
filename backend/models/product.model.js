import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, validate: value => Number.isFinite(value) && value > 0 },
  category: { type: String, required: true, trim: true },
  image: { type: String, required: true, trim: true, validate: value => /^https?:\/\/[^\s]+$/i.test(value) || /^\/product-images\/[a-z0-9-]+\.svg$/.test(value) },
  stock: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.model('Product', productSchema);
