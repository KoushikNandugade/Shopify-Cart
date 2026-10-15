import mongoose from 'mongoose';
import Product from '../models/product.model.js';

const samples = [
  ['Everyday Headphones', 'Immersive wireless over-ear headphones with soft ear cushions, active noise cancellation and up to 30 hours of listening. Your everyday escape, wherever you go.', 4999, 'Electronics', 'headphones', 25],
  ['Canvas Carryall', 'A generously sized cotton canvas tote with reinforced handles and an inside pocket. Made for market mornings, daily commutes and everything in between.', 899, 'Fashion', 'bag', 18],
  ['The Slow Living Journal', 'A thoughtful hardcover journal with 192 ruled pages, a ribbon bookmark and space for the small things that make your day.', 449, 'Books', 'book', 32],
  ['Ceramic Morning Mug', 'A warm, earthy ceramic mug with a comfortable handle and a hand-finished glaze. Holds 350 ml of your favourite morning ritual.', 599, 'Home', 'mug', 14],
  ['Mechanical Keyboard', 'A compact mechanical keyboard with tactile switches, adjustable backlighting and a detachable USB-C cable. A satisfying companion for focused work.', 2999, 'Electronics', 'keyboard', 10],
  ['Everyday Sneakers', 'Easygoing canvas sneakers with a cushioned footbed and a durable rubber sole. A versatile neutral finish for your everyday wardrobe.', 1799, 'Fashion', 'shoe', 0],
  ['Little Book of Ideas', 'An inspiring collection of creative prompts and practical exercises. A small companion for big ideas, with room for your own notes.', 349, 'Books', 'book', 20],
  ['Desk Companion Lamp', 'A compact desk lamp with a warm LED glow and a sturdy metal shade. A little extra light for reading, making and winding down.', 1299, 'Home', 'lamp', 7],
];
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  for (const [index, [name, description, price, category, image, stock]] of samples.entries()) {
    const _id = new mongoose.Types.ObjectId(`53000000000000000000000${index + 1}`);
    await Product.updateOne({ _id }, { $setOnInsert: { name, description, price, category, image: `/product-images/${image}.svg`, stock, createdAt: new Date() } }, { upsert: true, runValidators: true });
  }
  console.log('Sample catalog ensured: 8 products. Existing records were preserved.');
} catch (error) { console.error('Seed failed:', error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
