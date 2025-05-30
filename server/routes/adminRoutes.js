const express = require('express');
const {updateSubscription} = require("../controllers/adminController");
const { isAdmin } = require("../middleware/authMiddleware");
const { protect } = require('../middleware/authMiddleware');
const { getUsers, toggleBlockUser, deleteUser } = require('../controllers/adminController');

const router = express.Router();

// Получение списка всех пользователей
router.get('/users', isAdmin, getUsers);

// Блокировка/разблокировка пользователя
router.post('/users/:id/toggle-block', protect, toggleBlockUser);

// Удаление пользователя и всех связанных данных
router.delete('/users/:id', isAdmin, deleteUser);

// Обновление подписки пользователя
router.post('/users/:id/subscription', isAdmin, updateSubscription);

module.exports = router;