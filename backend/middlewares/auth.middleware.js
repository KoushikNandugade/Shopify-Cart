import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';
import { cookieName } from '../utils/generateToken.js';

export default async function authenticate(req, res, next) {
  const unauthorized = () => res.status(401).json({ success: false, message: 'Unauthorized' });
  const token = req.cookies[cookieName];
  if (!token) return unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return unauthorized();
  }
  if (!payload || !mongoose.isValidObjectId(payload.sub)) return unauthorized();
  try {
    const customer = await Customer.findById(payload.sub).select('+tokenVersion');
    if (!customer || payload.version !== customer.tokenVersion) return unauthorized();
    req.user = customer;
    next();
  } catch (error) {
    next(error);
  }
}
