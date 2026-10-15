import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';

function validateId(req, res) {
  if (mongoose.isObjectIdOrHexString(req.params.productId)) return true;
  res.status(400).json({ success: false, message: 'Invalid product ID' });
  return false;
}

export async function addToWishlist(req, res) {
  if (!validateId(req, res)) return;
  const productId = req.params.productId;
  if (!(await Product.exists({ _id: productId }))) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  // One atomic write prevents duplicates even when requests arrive together.
  const result = await Customer.updateOne(
    { _id: req.user._id, wishlist: { $ne: productId } },
    { $addToSet: { wishlist: productId } },
  );
  if (!result.modifiedCount) return res.status(409).json({ success: false, message: 'Product already in wishlist' });
  return res.status(201).json({ success: true, message: 'Product added to wishlist' });
}

export async function getWishlist(req, res) {
  const customer = await Customer.findById(req.user._id).select('wishlist').populate({
    path: 'wishlist', select: 'name price category image stock',
  });
  if (!customer) return res.status(401).json({ success: false, message: 'Unauthorized' });
  // Deleted products can leave dangling references; never render null cards.
  const wishlist = (customer.wishlist ?? []).filter(Boolean);
  return res.json({ success: true, count: wishlist.length, wishlist });
}

export async function removeFromWishlist(req, res) {
  if (!validateId(req, res)) return;
  // Do not require Product to exist: stale references can still be removed.
  const result = await Customer.updateOne(
    { _id: req.user._id, wishlist: req.params.productId },
    { $pull: { wishlist: req.params.productId } },
  );
  if (!result.modifiedCount) return res.status(404).json({ success: false, message: 'Product not in wishlist' });
  return res.json({ success: true, message: 'Product removed from wishlist' });
}
