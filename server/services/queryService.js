const {fetchAndParseProductsByArticle} = require("./productService");
const {fetchAndParseProducts} = require("./productService");
const { QueryModel } = require("../models/queryModel");
const { QueryArticleModel } = require("../models/queryArticleModel");
const { addDataToSheet } = require("./googleSheetService");

// Функция для выполнения всех запросов пользователя
const executeUserQueries = async (user) => {
    try {
        // Получаем все запросы пользователя
        const queries = await QueryModel.find({ userId: user._id });
        const articleQueries = await QueryArticleModel.find({ userId: user._id });

        // Уникальные запросы по бренду
        const uniqueBrandQueries = new Set();
        const uniqueBrandRequests = [];

        // Уникальные запросы по артикулу
        const uniqueArticleQueries = new Set();
        const uniqueArticleRequests = [];

        // Обработка запросов по бренду
        for (const query of queries) {
            const queriesArray = query.query.split('; ');
            const destsArray = query.dest.split('; ');
            const citiesArray = query.city.split('; ');
            const brandsArray = query.brand.split('; ');

            for (let i = 0; i < queriesArray.length; i++) {
                const queryText = queriesArray[i].trim();
                const dest = destsArray[i].trim();
                const city = citiesArray[i].trim();
                const brand = brandsArray[i].trim();

                // Создаем уникальный ключ для проверки дубликатов
                const uniqueKey = `${queryText}|${brand}|${city}`;

                // Если запрос уникальный, добавляем его в список
                if (!uniqueBrandQueries.has(uniqueKey)) {
                    uniqueBrandQueries.add(uniqueKey);
                    uniqueBrandRequests.push({ queryText, dest, city, brand });
                }
            }
        }

        // Обработка запросов по артикулу
        for (const query of articleQueries) {
            const queriesArray = query.query.split('; ');
            const articlesArray = query.article.split('; ');
            const destsArray = query.dest.split('; ');
            const citiesArray = query.city.split('; ');

            for (let i = 0; i < queriesArray.length; i++) {
                const queryText = queriesArray[i].trim();
                const article = articlesArray[i].trim();
                const dest = destsArray[i].trim();
                const city = citiesArray[i].trim();

                // Создаем уникальный ключ для проверки дубликатов
                const uniqueKey = `${queryText}|${article}|${city}`;

                // Если запрос уникальный, добавляем его в список
                if (!uniqueArticleQueries.has(uniqueKey)) {
                    uniqueArticleQueries.add(uniqueKey);
                    uniqueArticleRequests.push({ queryText, city, dest, article });
                }
            }
        }

        // Выполняем уникальные запросы по бренду
        for (const request of uniqueBrandRequests) {
            const { queryText, dest, brand } = request;

            const products = await fetchAndParseProducts(queryText, dest, brand, new Date().toISOString());
            const data = products.map(product => {
                const position = product?.page && product.page > 1
                    ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                    : String(product?.position);

                const promoPosition = product?.log?.promoPosition
                    ? `${product?.log?.promoPosition}*`
                    : position;

                return [
                    String(product.query),
                    String(product.brand),
                    String(product.city),
                    String(product.imageUrl),
                    String(product.id),
                    String(product.name),
                    promoPosition,
                    new Date(product.queryTime).toLocaleTimeString(),
                    new Date(product.queryTime).toLocaleDateString(),
                ];
            });

            await addDataToSheet(user.spreadsheetId, 'Бренд', data, true);
        }

        // Выполняем уникальные запросы по артикулу
        for (const request of uniqueArticleRequests) {
            const { queryText, dest, article } = request;

            const products = await fetchAndParseProductsByArticle(queryText, dest, article, new Date().toISOString());

            const data = products.map(product => {
                const position = product?.page && product.page > 1
                    ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                    : String(product?.position);

                const promoPosition = product?.log?.promoPosition
                    ? `${product?.log?.promoPosition}*`
                    : position;

                return [
                    String(product.query),
                    String(product.id),
                    String(product.city),
                    String(product.imageUrl),
                    String(product.brand),
                    String(product.name),
                    promoPosition,
                    new Date(product.queryTime).toLocaleTimeString(),
                    new Date(product.queryTime).toLocaleDateString(),
                ];
            });

            await addDataToSheet(user.spreadsheetId, 'Артикул', data, true);
        }
    } catch (error) {
        console.error(`Ошибка выполнения запросов для пользователя ${user.email}:`, error);
    }
};

module.exports = { executeUserQueries };