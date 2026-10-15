import bcrypt from 'bcrypt';
import Customer, { publicCustomer } from '../models/customer.model.js';
import generateToken, { cookieName, cookieOptions } from '../utils/generateToken.js';

const text = value => typeof value === 'string' && value.trim().length > 0;
const validPassword = value => typeof value === 'string' && value.length >= 6 && Buffer.byteLength(value, 'utf8') <= 72;
const fail = (res, status, message) => res.status(status).json({ success: false, message });

export async function register(req, res) {
  const { fullName, email, password, phone } = req.body ?? {};
  if (![fullName, email, password, phone].every(text)) {
    return fail(res, 400, 'Full name, email, password and phone are required');
  }
  if (!validPassword(password)) return fail(res, 400, 'Password must be at least 6 characters and at most 72 UTF-8 bytes');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return fail(res, 400, 'Enter a valid email');
  const normalizedEmail = email.trim().toLowerCase();
  if (await Customer.exists({ email: normalizedEmail })) return fail(res, 409, 'Email already exists');
  const customer = await Customer.create({
    fullName: fullName.trim(), email: normalizedEmail,
    password: await bcrypt.hash(password, 12), phone: phone.trim(),
  });
  return res.status(201).json({ success: true, message: 'Customer registered successfully', customer: publicCustomer(customer) });
}

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  if (!text(email) || !text(password)) return fail(res, 401, 'Invalid credentials');
  const customer = await Customer.findOne({ email: email.trim().toLowerCase() }).select('+password +tokenVersion');
  if (!customer || !(await bcrypt.compare(password, customer.password))) return fail(res, 401, 'Invalid credentials');
  generateToken(customer, res);
  return res.json({ success: true, message: 'Login successful', customer: publicCustomer(customer) });
}

export function profile(req, res) {
  res.json(publicCustomer(req.user));
}

export function logout(req, res) {
  res.clearCookie(cookieName, cookieOptions());
  res.json({ success: true, message: 'Logged out successfully' });
}

export async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body ?? {};
  if (!text(oldPassword) || !validPassword(newPassword)) {
    return fail(res, 400, 'Old password is required; new password must be at least 6 characters and at most 72 UTF-8 bytes');
  }
  const customer = await Customer.findById(req.user._id).select('+password +tokenVersion');
  if (!customer) return fail(res, 401, 'Unauthorized');
  if (!(await bcrypt.compare(oldPassword, customer.password))) return fail(res, 401, 'Invalid credentials');
  // Match the previous hash so simultaneous changes cannot overwrite each other.
  const result = await Customer.updateOne({ _id: customer._id, password: customer.password }, {
    $set: { password: await bcrypt.hash(newPassword, 12) }, $inc: { tokenVersion: 1 },
  });
  if (!result.modifiedCount) return fail(res, 409, 'Password changed concurrently; log in again');
  res.clearCookie(cookieName, cookieOptions());
  return res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
}
