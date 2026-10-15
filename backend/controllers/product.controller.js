import mongoose from 'mongoose';
import Product from '../models/product.model.js';

const fields = 'name description price category image stock createdAt';
export async function createProduct(req, res) {
  const { name, description, price, category, image, stock } = req.body ?? {};
  const strings = [name, description, category, image];
  if (!strings.every(value => typeof value === 'string' && value.trim()) ||
      typeof price !== 'number' || !Number.isFinite(price) || price <= 0 ||
      typeof stock !== 'number' || !Number.isSafeInteger(stock) || stock < 0) {
    return res.status(400).json({ success: false, message: 'Name, description, category and image are required; price must be positive and stock a nonnegative integer' });
  }
  const product = await Product.create({ name, description, price, category, image, stock });
  return res.status(201).json({ success: true, product: await Product.findById(product._id).select(fields).lean() });
}

export async function getProducts(req, res) {
  const { search = '', category = '', sort = '' } = req.query;
  if (![search, category, sort].every(value => typeof value === 'string') || search.length > 200 || category.length > 100) {
    return res.status(400).json({ success: false, message: 'Search and category must be short strings' });
  }
  if (!['', 'price_asc', 'price_desc'].includes(sort)) return res.status(400).json({ success: false, message: 'Sort must be price_asc or price_desc' });
  const filter = {};
  // Treat search as literal text, not user-supplied regex syntax.
  if (search.trim()) filter.name = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (category.trim()) filter.category = category.trim();
  const order = sort ? { price: sort === 'price_asc' ? 1 : -1, _id: 1 } : { createdAt: -1, _id: 1 };
  const products = await Product.find(filter).select(fields).sort(order).lean();
  return res.json({ success: true, count: products.length, products });
}

export async function getProduct(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid product ID' });
  const product = await Product.findById(req.params.id).select(fields).lean();
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  return res.json({ success: true, product });
}
