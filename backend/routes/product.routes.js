import { Router } from 'express';
import { createProduct, getProducts, getProduct } from '../controllers/product.controller.js';

const router = Router();
// Deliberately open for Lab 03; admin authorization is a future lab.
router.post('/', createProduct);
router.get('/', getProducts);
router.get('/:id', getProduct);
export default router;
