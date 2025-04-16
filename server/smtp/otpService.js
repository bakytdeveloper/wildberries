const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

// Хранилище OTP
let otpStorage = {};

const transporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

const sendOTP = (email) => {
    const otp = crypto.randomInt(100000, 999999).toString();
    otpStorage[email] = otp;

    transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Здравствуйте',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <p>Мы обновили ваш пароль для авторизации.</p>
                <p>Это ваш обновлённый пароль, запишите его в надёжное место и используйте для входа в ваш аккаунт:</p>
                <p style="font-size: 18px; font-weight: bold; color: #2c3e50; background-color: #f8f9fa; 
                   padding: 10px; border-radius: 5px; display: inline-block;">
                    ${otp}
                </p>
                <p style="margin-top: 20px;">С уважением,<br>Команда сервиса</p>
            </div>
        `,
        // Оставляем text-версию для клиентов, которые не поддерживают HTML
        text: `Мы обновили ваш пароль для авторизации. Это ваш обновлённый пароль, запишите его в надёжное место и используйте для входа в ваш аккаунт: ${otp}`
    });

    return otp;
};

const verifyOTP = (email, otp) => {
    return otpStorage[email] === otp;
};

module.exports = {
    sendOTP,
    verifyOTP,
    transporter,
};