import { Router } from 'express';
import { register, login, profile, logout, changePassword } from '../controllers/customer.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, profile);
router.post('/logout', authenticate, logout);
router.patch('/change-password', authenticate, changePassword);
export default router;
