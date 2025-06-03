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
        user.subscription.isTrial = false; // Пробный период завершен
        user.subscription.trialEndDate = null;


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
        const endDate = user.subscription.subscriptionEndDate.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const message = {
            from: process.env.SMTP_FROM,
            to: user.email,
            subject: '❗ Ваша подписка скоро закончится',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <h2 style="color: #2c3e50;">Уважаемый ${user.name || 'пользователь'}!</h2>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                        <p style="margin: 0; font-size: 16px; color: #2c3e50;">
                            <strong>Срок действия вашей подписки истекает ${endDate}.</strong>
                        </p>
                    </div>
                    
                    <p style="font-size: 15px; line-height: 1.6; color: #34495e;">
                        Чтобы продолжить пользоваться всеми возможностями сервиса без ограничений, необходимо продлить подписку.
                    </p>
                    
                    <p style="font-size: 15px; line-height: 1.6; color: #34495e;">
                        <strong>Обратите внимание:</strong> если подписка не будет продлена в течение 3 дней после окончания, ваш аккаунт будет временно заблокирован.
                    </p>
                                        
                    <p style="font-size: 14px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px;">
                        Если у вас возникли вопросы, вы всегда можете обратиться к администратору 
                    </p>
                    
                    <div style="margin-top: 30px; text-align: center; color: #7f8c8d; font-size: 13px;">
                        <p>С уважением,<br>Команда ${process.env.APP_NAME || 'нашего сервиса'}</p>
                    </div>
                </div>
            `,
            text: `
                    Уважаемый ${user.name || 'пользователь'}!
                    
                    Срок действия вашей подписки истекает ${endDate}.
                    
                    Чтобы продолжить пользоваться всеми возможностями сервиса без ограничений, необходимо продлить подписку.
                    
                    Обратите внимание: если подписка не будет продлена в течение 3 дней после окончания, ваш аккаунт будет временно заблокирован.
                    
                    Продлить подписку
                    
                    Если у вас возникли вопросы, вы всегда можете обратиться к администратору сайта
                    
                    С уважением,
                    Команда ${process.env.APP_NAME || 'нашего сервиса'}
                                `
        };

        await transporter.sendMail(message);
    } catch (error) {
        console.error('Ошибка при отправке напоминания:', error);
    }
};

module.exports = {
    getUsers,
    toggleBlockUser,
    deleteUser,
    updateSubscription,
    checkSubscriptions
};