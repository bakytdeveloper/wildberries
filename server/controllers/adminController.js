const { QueryArticleModel } = require("../models/queryArticleModel");
const { QueryModel } = require("../models/queryModel");
const { UserModel } = require('../models/userModel');

// Получение списка всех пользователей
const getUsers = async (req, res) => {
    try {
        // Возвращаем всех пользователей, кроме администратора
        const users = await UserModel.find({}, { password: 0 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при получении списка пользователей' });
    }
};

// Блокировка/разблокировка пользователя
const toggleBlockUser = async (req, res) => {
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
};

// Удаление пользователя и всех связанных данных
const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        // Удаляем пользователя
        const user = await UserModel.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Удаляем все запросы пользователя
        await QueryModel.deleteMany({ userId });

        // Удаляем все статьи пользователя
        await QueryArticleModel.deleteMany({ userId });

        res.json({ message: 'Пользователь и все связанные данные успешно удалены' });
    } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        res.status(500).json({ error: 'Ошибка при удалении пользователя' });
    }
};

module.exports = {
    getUsers,
    toggleBlockUser,
    deleteUser
};