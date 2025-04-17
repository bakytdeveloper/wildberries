const {transporter} = require("../smtp/otpService");
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

// Обновление подписки пользователя
const updateSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        const user = await UserModel.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const months = Math.floor(amount / 1000);
        if (months <= 0) {
            return res.status(400).json({ error: 'Сумма должна быть не менее 1000' });
        }

        const currentDate = new Date();
        const subscriptionEndDate = new Date();

        if (user.isBlocked || !user.subscription.subscriptionEndDate || user.subscription.subscriptionEndDate < currentDate) {
            // Устанавливаем новую дату от текущей
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + months);
        } else {
            // Добавляем к существующей дате
            subscriptionEndDate.setTime(user.subscription.subscriptionEndDate.getTime());
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + months);
        }

        user.subscription.amount = amount;
        user.subscription.subscriptionEndDate = subscriptionEndDate;
        user.subscription.lastPaymentDate = currentDate;
        user.subscription.paymentReminderSent = false;

        // Разблокируем пользователя при оплате
        if (user.isBlocked) {
            user.isBlocked = false;
            user.unblockedAt = currentDate;
            user.blockedAt = null;
        }

        await user.save();
        res.json(user);
    } catch (error) {
        console.error('Ошибка при обновлении подписки:', error);
        res.status(500).json({ error: 'Ошибка при обновлении подписки' });
    }
};

// Проверка подписок и отправка напоминаний
// Изменённая функция checkSubscriptions
const checkSubscriptions = async () => {
    try {
        const currentDate = new Date();
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + 3); // 3 дня вперед

        // Находим пользователей, у которых подписка заканчивается через 3 дня или меньше
        // И которые не заблокированы
        const usersToRemind = await UserModel.find({
            'subscription.subscriptionEndDate': {
                $lte: reminderDate,
                $gt: currentDate
            },
            isBlocked: false
        });

        // Отправляем напоминания
        for (const user of usersToRemind) {
            await sendPaymentReminder(user);
            console.log(`Напоминание отправлено пользователю ${user.email}`);
        }

        // Блокируем пользователей с истекшей подпиской
        const expiredUsers = await UserModel.find({
            'subscription.subscriptionEndDate': { $lt: currentDate },
            isBlocked: false
        });

        for (const user of expiredUsers) {
            user.isBlocked = true;
            user.blockedAt = currentDate;
            user.unblockedAt = null;
            await user.save();
            console.log(`Пользователь ${user.email} заблокирован по истечении подписки`);
        }

        console.log(`Отправлено напоминаний: ${usersToRemind.length}, заблокировано пользователей: ${expiredUsers.length}`);
    } catch (error) {
        console.error('Ошибка при проверке подписок:', error);
    }
};

// Функция отправки напоминания (можно использовать transporter из otpService.js)
const sendPaymentReminder = async (user) => {
    try {
        const endDate = user.subscription.subscriptionEndDate.toLocaleDateString();
        const message = {
            from: process.env.SMTP_FROM,
            to: user.email,
            subject: 'Напоминание об оплате подписки',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <p>Ваша подписка истекает ${endDate}.</p>
                    <p>Пожалуйста, продлите подписку, чтобы продолжить пользоваться сервисом без ограничений.</p>
                    <p style="margin-top: 20px;">С уважением,<br>Команда сервиса</p>
                </div>
            `,
            text: `Ваша подписка истекает ${endDate}. Пожалуйста, продлите подписку, чтобы продолжить пользоваться сервисом без ограничений.`
        };

        await transporter.sendMail(message);
    } catch (error) {
        console.error('Ошибка при отправке напоминания:', error);
    }
};

// Запускаем проверку подписок каждые 24 часа
setInterval(checkSubscriptions, 24 * 60 * 60 * 1000);
// Первая проверка при запуске сервера
setTimeout(checkSubscriptions, 5000);

module.exports = {
    getUsers,
    toggleBlockUser,
    deleteUser,
    updateSubscription
};