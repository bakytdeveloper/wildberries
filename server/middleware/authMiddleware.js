const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const {UserModel} = require("../models/userModel");
dotenv.config();

const jwtSecret = process.env.JWT_SECRET || 'yourSecretKey';

const protect = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);

        if (decoded.userId === 'admin') {
            req.userId = 'admin';
            return next();
        }

        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};


const isAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);

        // Если это администратор, пропускаем проверку
        if (decoded.userId === 'admin' && decoded.isAdmin) {
            req.userId = 'admin';
            return next();
        }

        res.status(403).json({ error: 'Forbidden' });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const forGoogleSheets = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);

        if (decoded.userId === 'admin') {
            req.user = { userId: 'admin', isAdmin: true };
            return next();
        }

        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = { userId: decoded.userId, isAdmin: false };
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const checkTrialAccess = async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        // Если пользователь в пробном периоде и он не истек
        if (user.subscription.isTrial && user.subscription.trialEndDate >= new Date()) {
            return next();
        }

        // Если пользователь не в пробном периоде или имеет оплаченную подписку
        if (!user.subscription.isTrial || (user.subscription.amount > 0 && user.subscription.subscriptionEndDate >= new Date())) {
            return next();
        }

        // Если пробный период истек и подписка не оплачена
        res.status(403).json({
            message: 'Пробный период закончился. Пожалуйста, оплатите подписку для продолжения работы.'
        });
    } catch (error) {
        console.error('Ошибка при проверке пробного периода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};


module.exports = { protect, isAdmin, forGoogleSheets, checkTrialAccess };


