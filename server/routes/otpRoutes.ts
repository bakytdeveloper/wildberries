import express from 'express';
import {sendOTPController} from "../controllers/otpController";

const router = express.Router();

router.post('/send-otp', sendOTPController);

export default router;
