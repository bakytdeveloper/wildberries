const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const {sendExcelFileToUser} = require("../services/excelService");
const {createExcelFileForUser} = require("../services/excelService");
const { UserModel } = require('../models/userModel');
const { sendOTP } = require('../smtp/otpService');
const { createSpreadsheetForUser } = require('../services/googleSheetService');
dotenv.config();

const jwtSecret = process.env.JWT_SECRET || 'yourSecretKey';

const registerUser = async (req, res) => {
    const { username, password, email } = req.body;

    try {
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
        }

        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Пользователь уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new UserModel({ username, email, password: hashedPassword });

        // Создание Google Таблицы для пользователя
        const spreadsheetId = await createSpreadsheetForUser(email);
        newUser.spreadsheetId = spreadsheetId;

        await newUser.save();

        const token = jwt.sign({ userId: newUser._id }, jwtSecret, { expiresIn: '24h' });
        res.status(201).json({ token });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Регистрация не удалась' });
    }
};


const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Требуется адрес электронной почты и пароль.' });
    }

    try {
        // Проверка на админа
        if (email === 'admin@gmail.com' && password === 'admin') {
            const token = jwt.sign({ userId: 'admin', isAdmin: true }, jwtSecret, { expiresIn: '24h' });
            return res.json({ token, isAdmin: true });
        }

        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Неверный адрес электронной почты или пароль' });
        }

        // Проверяем, заблокирован ли пользователь
        if (user.isBlocked) {
            return res.status(403).json({ message: 'Пользователь заблокирован. Обратитесь в службу поддержки.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Неверный адрес электронной почты или пароль' });
        }

        const token = jwt.sign({ userId: user._id, isAdmin: false }, jwtSecret, { expiresIn: '24h' });
        res.json({ token, isAdmin: false });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Ошибка входа' });
    }
};



const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newPassword = sendOTP(email);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ message: 'Password reset successfully, please check your email' });
    } catch (error) {
        res.status(500).json({ error: 'Password reset failed' });
    }
};

module.exports = { registerUser, loginUser, forgotPassword };
