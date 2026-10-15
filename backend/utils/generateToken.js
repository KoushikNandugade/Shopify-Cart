import jwt from 'jsonwebtoken';

export const cookieName = 'shopkart_token';
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
}

export default function generateToken(customer, res) {
  const token = jwt.sign(
    { version: customer.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { subject: customer._id.toString(), expiresIn: '1h', algorithm: 'HS256' },
  );
  res.cookie(cookieName, token, { ...cookieOptions(), maxAge: 60 * 60 * 1000 });
}
