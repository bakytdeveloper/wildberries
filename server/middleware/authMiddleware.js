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

        // Если это администратор, пропускаем проверку в базе данных
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

// Добавьте это в authMiddleware.js
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

module.exports = { protect, isAdmin, forGoogleSheets };


