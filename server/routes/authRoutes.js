const express = require('express');
const { registerUser, loginUser, forgotPassword } = require('../controllers/authController');
const { check } = require('express-validator');
const { sendOTP } = require('../smtp/otpService');

const router = express.Router();

router.post(
    '/register',
    [check('username').not().isEmpty(), check('password').isLength({ min: 6 }), check('email').isEmail()],
    registerUser
);

router.post(
    '/login',
    [check('email').isEmail(), check('password').isLength({ min: 6 })],
    loginUser
);

router.post('/forgot-password', [check('email').isEmail()], forgotPassword);

// Маршрут для отправки OTP без авторизации
router.post('/send-otp', sendOTP);

module.exports = router;
