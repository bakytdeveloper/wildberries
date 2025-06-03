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

const sendOTP = (email, name = 'пользователь') => {
    const otp = crypto.randomInt(100000, 999999).toString();
    otpStorage[email] = otp;

    const mailOptions = {
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Ваш новый пароль для доступа к аккаунту',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #2c3e50;">Здравствуйте, ${name}!</h2>
                </div>
                
                <p style="font-size: 15px; line-height: 1.6; color: #34495e;">
                    Вы получили это письмо, потому что был запрошен новый пароль для вашего аккаунта.
                </p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #7f8c8d;">
                        Ваш обновлённый пароль:
                    </p>
                    <div style="font-size: 24px; font-weight: bold; color: #2c3e50; letter-spacing: 2px;
                         padding: 10px 15px; background-color: white; border-radius: 4px; 
                         border: 1px dashed #3498db; display: inline-block;">
                        ${otp}
                    </div>
                </div>
                
                <div style="background-color: #fff8e1; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; font-size: 14px; color: #5d4037;">
                        <strong>Важно:</strong> Не распрастранять его и не терять. 
                    </p>
                </div>
                
                <p style="font-size: 14px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px;">
                    Если вы не запрашивали смену пароля, пожалуйста, немедленно свяжитесь с нашим администратором
                </p>
                
                <div style="margin-top: 30px; text-align: center; color: #7f8c8d; font-size: 13px;">
                    <p>С уважением,<br>Команда ${process.env.REACT_APP_API_HOST || 'сервиса'}</p>
                </div>
            </div>
        `,
        text: `
Здравствуйте, ${name}!

Вы получили это письмо, потому что был запрошен новый пароль для вашего аккаунта.

Ваш обновлённый пароль: ${otp}

Важно: Чтобы вы сохранили обновлённыйй пароль и никому не давали его.

Если вы не запрашивали смену пароля, пожалуйста, немедленно свяжитесь с администратором

С уважением,
Команда ${process.env.REACT_APP_API_HOST || 'сервиса'}
        `
    };

    transporter.sendMail(mailOptions, (error) => {
        if (error) {
            console.error('Ошибка при отправке письма с паролем:', error);
        }
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