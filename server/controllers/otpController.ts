import { Request, Response } from 'express';
import { sendOTP } from '../smtp/otpService';

export const sendOTPController = (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        sendOTP(email);
        res.status(200).json({ message: 'OTP sent' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ message: 'Error sending OTP' });
    }
};
