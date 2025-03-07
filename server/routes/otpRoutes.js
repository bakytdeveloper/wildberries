const express = require('express');
const { sendOTPController } = require('../controllers/otpController');

const router = express.Router();

router.post('/send-otp', sendOTPController);

module.exports = router;
