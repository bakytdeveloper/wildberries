const { QueryModel } = require("../models/queryModel");
const { QueryArticleModel } = require("../models/queryArticleModel");
const { addDataToSheet } = require("./googleSheetService");

const executeUserQueries = async (user) => {
    try {

        // Добавляем проверку на блокировку
        if (user.isBlocked) {
            console.log(`Пользователь ${user.email} заблокирован, выгрузка отменена`);
            return;
        }

        // Получаем последние автоматические запросы для пользователя
        const [latestBrandQuery, latestArticleQuery] = await Promise.all([
            QueryModel.findOne({ userId: user._id, isAutoQuery: true })
                .sort({ createdAt: -1 })
                .populate('productTables.products'),
            QueryArticleModel.findOne({ userId: user._id, isAutoQuery: true })
                .sort({ createdAt: -1 })
                .populate('productTables.products')
        ]);

        // Обработка данных по брендам
        if (latestBrandQuery) {
            const brandData = latestBrandQuery.productTables.flatMap((table) =>
                table.products.map((product) => {
                    const position = product?.page && product.page > 1
                        ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                        : String(product?.position);

                    const promoPosition = product?.log?.promoPosition
                        ? `${product?.log?.promoPosition}*`
                        : position;

                    return [
                        String(product?.query || latestBrandQuery.query),
                        String(product?.brand || latestBrandQuery.brand),
                        String(product?.city || latestBrandQuery.city),
                        String(product?.imageUrl),
                        String(product?.id),
                        String(product?.name),
                        promoPosition,
                        new Date(product?.queryTime || latestBrandQuery.createdAt).toLocaleTimeString(),
                        new Date(product?.queryTime || latestBrandQuery.createdAt).toLocaleDateString(),
                    ];
                })
            );

            if (brandData.length > 0) {
                await addDataToSheet(user.spreadsheetId, 'Бренд', brandData, true);
            }
        }

        // Обработка данных по артикулам
        if (latestArticleQuery) {
            const articleData = latestArticleQuery.productTables.flatMap((table) =>
                table.products.map((product) => {
                    const position = product?.page && product.page > 1
                        ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                        : String(product?.position);

                    const promoPosition = product?.log?.promoPosition
                        ? `${product?.log?.promoPosition}*`
                        : position;

                    return [
                        String(product?.query || latestArticleQuery.query),
                        String(product?.id),
                        String(product?.city || latestArticleQuery.city),
                        String(product?.imageUrl),
                        String(product?.brand),
                        String(product?.name),
                        promoPosition,
                        new Date(product?.queryTime || latestArticleQuery.createdAt).toLocaleTimeString(),
                        new Date(product?.queryTime || latestArticleQuery.createdAt).toLocaleDateString(),
                    ];
                })
            );

            if (articleData.length > 0) {
                await addDataToSheet(user.spreadsheetId, 'Артикул', articleData, true);
            }
        }
    } catch (error) {
        console.error(`Ошибка выполнения запросов для пользователя ${user.email}:`, error);
        throw error;
    }
};

module.exports = { executeUserQueries };