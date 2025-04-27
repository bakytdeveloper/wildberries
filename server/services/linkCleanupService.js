const { QueryModel } = require("../models/queryModel");
const { QueryArticleModel } = require("../models/queryArticleModel");
const { UserModel } = require("../models/userModel");

async function cleanupBrokenLinks() {
    try {
        console.log("Запуск очистки битых ссылок...");

        // Находим всех пользователей с непустым массивом queries
        const users = await UserModel.find({ queries: { $exists: true, $not: { $size: 0 } } });

        let totalCleaned = 0;

        for (const user of users) {
            const validQueries = [];
            let hasInvalidLinks = false;

            // Проверяем каждую ссылку в queries пользователя
            for (const queryId of user.queries) {
                try {
                    // Проверяем существование в QueryModel
                    const queryExists = await QueryModel.exists({ _id: queryId });
                    // Проверяем существование в QueryArticleModel
                    const articleQueryExists = await QueryArticleModel.exists({ _id: queryId });

                    if (queryExists || articleQueryExists) {
                        validQueries.push(queryId);
                    } else {
                        hasInvalidLinks = true;
                        console.log(`Найдена битая ссылка: ${queryId} у пользователя ${user._id}`);
                    }
                } catch (error) {
                    console.error(`Ошибка при проверке ссылки ${queryId}:`, error);
                    // В случае ошибки оставляем ссылку как есть
                    validQueries.push(queryId);
                }
            }

            // Если найдены битые ссылки, обновляем пользователя
            if (hasInvalidLinks) {
                await UserModel.updateOne(
                    { _id: user._id },
                    { $set: { queries: validQueries } }
                );
                totalCleaned += (user.queries.length - validQueries.length);
            }
        }

        console.log(`Очистка битых ссылок завершена. Удалено ${totalCleaned} битых ссылок.`);
        return { totalCleaned };
    } catch (error) {
        console.error("Ошибка в процессе очистки битых ссылок:", error);
        throw error;
    }
}

module.exports = { cleanupBrokenLinks };