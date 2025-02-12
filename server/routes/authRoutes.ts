import express from 'express';
import { registerUser, loginUser, forgotPassword } from '../controllers/authController';
import { check } from 'express-validator';
import {sendOTP} from "../smtp/otpService";

const router = express.Router();

router.post('/register',
    [check('username').not().isEmpty(), check('password').isLength({ min: 6 }), check('email').isEmail()],
    registerUser
);
router.post('/login',
    [check('email').isEmail(), check('password').isLength({ min: 6 })],
    loginUser
);
router.post('/forgot-password', [check('email').isEmail()], forgotPassword);

// Маршрут для отправки OTP без авторизации
router.post('/send-otp', sendOTP);

export default router;
