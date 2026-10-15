import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';

const fail = (res, status, message) => res.status(status).json({ success: false, message });

async function cartData(userId) {
  const customer = await Customer.findById(userId).select('cart');
  if (!customer) return null;
  const ids = (customer.cart ?? []).map(item => item.product.toString());
  await customer.populate({ path: 'cart.product', select: 'name price category image stock' });
  const cart = (customer.cart ?? []).filter(item => item.product);
  const unavailableProductIds = ids.filter((_id, index) => !customer.cart[index].product);
  return { cart, unavailableProductIds };
}

export async function getCart(req, res) {
  const data = await cartData(req.user._id);
  if (!data) return fail(res, 401, 'Unauthorized');
  return res.json({ success: true, ...data });
}

export async function mutateCart(req, res) {
  const { productId } = req.params;
  if (!mongoose.isObjectIdOrHexString(productId)) return fail(res, 400, 'Invalid product ID');
  const quantity = req.body?.quantity;
  if (req.method === 'PATCH' && (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1)) {
    return fail(res, 400, 'Quantity must be a positive whole number');
  }
  // Compare-and-swap the customer's cart version. Independent wishlist/password
  // writes cannot overwrite this cart, and concurrent adds cannot lose increments.
  for (let attempt = 0; attempt < 12; attempt++) {
    const customer = await Customer.findById(req.user._id).select('cart +cartVersion').lean();
    if (!customer) return fail(res, 401, 'Unauthorized');
    const cart = (customer.cart ?? []).map(item => ({ product: item.product, quantity: item.quantity }));
    const index = cart.findIndex(item => item.product.toString() === productId.toLowerCase());
    if (req.method === 'DELETE') {
      if (index < 0) return fail(res, 404, 'Product not in cart');
      cart.splice(index, 1); // Also permits removal of a reference to a deleted product.
    } else {
      const product = await Product.findById(productId).select('stock');
      if (!product) return fail(res, 404, 'Product not found');
      if (req.method === 'PATCH' && index < 0) return fail(res, 404, 'Product not in cart');
      const nextQuantity = req.method === 'POST' ? (index < 0 ? 1 : cart[index].quantity + 1) : quantity;
      if (nextQuantity > product.stock) return fail(res, 400, `Only ${product.stock} units available`);
      if (index < 0) cart.push({ product: product._id, quantity: nextQuantity });
      else cart[index].quantity = nextQuantity;
    }
    const version = customer.cartVersion ?? 0;
    const result = await Customer.updateOne({
      _id: customer._id,
      ...(version === 0 ? { $or: [{ cartVersion: 0 }, { cartVersion: { $exists: false } }] } : { cartVersion: version }),
    }, { $set: { cart }, $inc: { cartVersion: 1 } }, { runValidators: true });
    if (!result.modifiedCount) continue;
    const data = await cartData(customer._id);
    if (!data) return fail(res, 401, 'Unauthorized');
    return res.json({ success: true, message: req.method === 'DELETE' ? 'Product removed from cart' : 'Cart updated', ...data });
  }
  return fail(res, 409, 'Cart changed concurrently. Please try again.');
}
