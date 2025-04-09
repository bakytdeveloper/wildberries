const { sendOTP } = require('../smtp/otpService');

const sendOTPController = (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Требуется адрес электронной почты' });
    }

    try {
        sendOTP(email);
        res.status(200).json({ message: 'OTP отправлен' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ message: 'Ошибка отправки одноразового пароля' });
    }
};

module.exports = { sendOTPController };