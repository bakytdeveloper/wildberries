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
        text: `Мы обновили ваш пароль для авторизации, это ваш обновлённый пароль: ${otp}`
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