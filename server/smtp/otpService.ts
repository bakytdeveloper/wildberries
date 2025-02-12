import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Определяем тип для otpStorage
interface OtpStorage {
    [key: string]: string;
}

let otpStorage: OtpStorage = {};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'bakytdeveloper@gmail.com',
        pass: 'vlud glov uens emlz'
    }
});

export const sendOTP = (email: string): string => {
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

export const verifyOTP = (email: string, otp: string): boolean => {
    return otpStorage[email] === otp;
};

export { transporter };
