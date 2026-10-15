import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import { getCart, mutateCart } from '../controllers/cart.controller.js';

const router = Router();
router.use(authenticate);
router.get('/', getCart);
router.post('/:productId', mutateCart);
router.patch('/:productId', mutateCart);
router.delete('/:productId', mutateCart);
export default router;
