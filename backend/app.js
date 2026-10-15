import express from 'express';
import cookieParser from 'cookie-parser';
import customerRoutes from './routes/customer.routes.js';
import productRoutes from './routes/product.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import { fileURLToPath } from 'node:url';

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
app.get('/health', (_req, res) => res.json({ success: true, service: 'ShopKart authentication' }));
app.use('/customers', customerRoutes);
app.use('/products', productRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);
app.use('/product-images', express.static(fileURLToPath(new URL('./public/product-images', import.meta.url))));
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((error, _req, res, _next) => {
  if (error.code === 11000) return res.status(409).json({ success: false, message: 'Email already exists' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  if (error.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Request body too large' });
  if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: 'Invalid customer data' });
  console.error('Request failed:', error.name);
  return res.status(500).json({ success: false, message: 'Internal server error' });
});
export default app;
