import mongoose from 'mongoose';
import app from './app.js';
import Customer from './models/customer.model.js';
import Order from './models/order.model.js';

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) {
    throw new Error('Set JWT_SECRET to a random secret of at least 32 characters');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Customer.init(); // Wait for the unique email index before accepting requests.
  await Order.init();
  const server = app.listen(Number(process.env.PORT || 5000), '0.0.0.0');
  server.on('listening', () => console.log(`ShopKart API listening on port ${server.address().port}`));
  server.on('error', error => { console.error(error.message); process.exit(1); });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => { await mongoose.disconnect(); process.exit(0); }));
  }
}
start().catch(error => { console.error('Startup failed:', error.message); process.exit(1); });
