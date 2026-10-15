import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import { addToWishlist, getWishlist, removeFromWishlist } from '../controllers/wishlist.controller.js';

const router = Router();
router.use(authenticate);
router.get('/', getWishlist);
router.post('/:productId', addToWishlist);
router.delete('/:productId', removeFromWishlist);
export default router;
