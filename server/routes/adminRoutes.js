const express = require('express');
const {isAdmin} = require("../middleware/authMiddleware");
const { UserModel } = require('../models/userModel');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// Получение списка всех пользователей
router.get('/users', isAdmin, async (req, res) => {
    try {
        // Возвращаем всех пользователей, кроме администратора
        const users = await UserModel.find({}, { password: 0 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при получении списка пользователей' });
    }
});


// Блокировка/разблокировка пользователя
router.post('/users/:id/toggle-block', protect, async (req, res) => {
    try {
        const user = await UserModel.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        user.isBlocked = !user.isBlocked;
        if (user.isBlocked) {
            user.blockedAt = new Date();
            user.unblockedAt = null;
        } else {
            user.unblockedAt = new Date();
            user.blockedAt = null;
        }

        await user.save();
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при блокировке/разблокировке пользователя' });
    }
});

// Удаление пользователя
router.delete('/users/:id', protect, async (req, res) => {
    try {
        const user = await UserModel.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json({ message: 'Пользователь успешно удален' });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при удалении пользователя' });
    }
});

module.exports = router;