const { UserModel } = require('../models/userModel');
const { QueryModel } = require('../models/queryModel');
const { QueryArticleModel } = require('../models/queryArticleModel');

// Проверка пробных периодов и блокировка/удаление пользователей
const checkTrialPeriods = async () => {
    try {
        const currentDate = new Date();
        const twoDaysBefore = new Date();
        twoDaysBefore.setDate(twoDaysBefore.getDate() + 2); // 2 дня до окончания пробного периода

        // 1. Находим пользователей, у которых до окончания пробного периода осталось 2 дня
        const usersToWarn = await UserModel.find({
            'subscription.isTrial': true,
            'subscription.trialEndDate': {
                $lte: twoDaysBefore,
                $gt: currentDate
            },
            'subscription.trialWarningSent': false,
            isBlocked: false
        });

        // Отправляем предупреждения
        for (const user of usersToWarn) {
            user.subscription.trialWarningSent = true;
            await user.save();
            console.log(`Предупреждение отправлено пользователю ${user.email} о скором окончании пробного периода`);
        }

        // 1. Находим пользователей с истекшим пробным периодом (2 дня)
        const trialEndedUsers = await UserModel.find({
            'subscription.isTrial': true,
            'subscription.trialEndDate': { $lt: currentDate },
            isBlocked: false
        });

        // Блокируем пользователей с истекшим пробным периодом
        for (const user of trialEndedUsers) {
            user.isBlocked = true;
            user.blockedAt = currentDate;
            await user.save();
            console.log(`Пользователь ${user.email} заблокирован по окончании пробного периода`);
        }

        // 2. Находим пользователей, которые не оплатили подписку в течение 5 дней после окончания пробного периода
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        const usersToDelete = await UserModel.find({
            'subscription.isTrial': true,
            'subscription.trialEndDate': { $lt: fiveDaysAgo },
            'subscription.amount': 0, // Не оплатили подписку
            isBlocked: true
        });

        // Удаляем пользователей и их данные
        for (const user of usersToDelete) {
            await deleteUserData(user._id);
            console.log(`Пользователь ${user.email} и его данные удалены`);
        }

        console.log(`Проверка пробных периодов завершена. Заблокировано: ${trialEndedUsers.length}, удалено: ${usersToDelete.length}`);
    } catch (error) {
        console.error('Ошибка при проверке пробных периодов:', error);
    }
};

// Удаление пользователя и всех связанных данных (аналогично deleteUser из adminController)
const deleteUserData = async (userId) => {
    try {
        // Удаляем пользователя
        await UserModel.findByIdAndDelete(userId);

        // Удаляем все запросы пользователя
        await QueryModel.deleteMany({ userId });

        // Удаляем все статьи пользователя
        await QueryArticleModel.deleteMany({ userId });

        // Здесь можно добавить удаление других связанных данных, если необходимо
    } catch (error) {
        console.error('Ошибка при удалении данных пользователя:', error);
    }
};

// Запускаем проверку каждые 6 часов
setInterval(checkTrialPeriods, 6 * 60 * 60 * 1000);
// Первая проверка при запуске сервера
setTimeout(checkTrialPeriods, 10000);

module.exports = { checkTrialPeriods, deleteUserData };