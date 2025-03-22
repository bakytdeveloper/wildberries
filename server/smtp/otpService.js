const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Хранилище OTP
let otpStorage = {};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bakytdeveloper@gmail.com',
        pass: 'vlud glov uens emlz' // Обратите внимание, что для реального использования важно безопасно хранить такие данные
    }
});

const sendOTP = (email) => {
    const otp = crypto.randomInt(100000, 999999).toString();
    otpStorage[email] = otp;
    transporter.sendMail({
        from: 'bakytdeveloper@gmail.com',
        to: email,
        subject: 'Здравствуйте',
        text: `Мы обновили ваш пароль для авторизации, это ваш обновлённый пароль: ${otp}`
    });
    return otp;
};

const verifyOTP = (email, otp) => {
    return otpStorage[email] === otp;
};

// Новая функция для отправки ссылки на Excel-файл
const sendExcelLink = async (email, fileLink) => {
    try {
        await transporter.sendMail({
            from: 'bakytdeveloper@gmail.com',
            to: email,
            subject: 'Ваша Excel-таблица',
            text: `Здравствуйте! Ваша Excel-таблица готова. Вы можете скачать её по ссылке: ${fileLink}`,
            html: `<p>Здравствуйте! Ваша Excel-таблица готова. Вы можете скачать её по <a href="${fileLink}">Ссылка на Excel-таблицу</a>.</p>`
        });
        console.log('Письмо с ссылкой на Excel-таблицу отправлено.');
    } catch (error) {
        console.error('Ошибка при отправке письма:', error);
        throw error;
    }
};


module.exports = { sendOTP, verifyOTP, transporter, sendExcelLink };
