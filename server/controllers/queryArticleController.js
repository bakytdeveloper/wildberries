const fs = require("fs");
const {QueryModel} = require("../models/queryModel");
const {streamExcelForUser} = require("../services/excelService");
const {exportAllDataToSheet} = require("../services/googleSheetService");
const {generateExcelForUser} = require("../services/excelService");
const { QueryArticleModel } = require('../models/queryArticleModel');
const { fetchAndParseProductsByArticle } = require('../services/productService');
const { UserModel } = require('../models/userModel');
const { addDataToSheet } = require('../services/googleSheetService');

// Создание нового запроса
const createArticleQuery = async (req, res) => {
    const { forms } = req.body;
    const userId = req.userId;

    if (!forms || !Array.isArray(forms) || forms.length === 0) {
        res.status(400).json({ error: 'Invalid request format' });
        return;
    }

    try {
        const productTables = await Promise.all(forms.map(async (form) => {
            const products = await fetchAndParseProductsByArticle(form.query, form.dest, form.article, form.queryTime);
            return { tableId: form.id, products };
        }));

        const newQuery = new QueryArticleModel({
            userId,
            query: forms.map(form => form.query).join('; '),
            article: forms.map(form => form.article).join('; '),
            dest: forms.map(form => form.dest).join('; '),
            productTables,
            createdAt: new Date(forms[0].queryTime),
            city: forms.map(form => form.city).join('; ')
        });

        await newQuery.save();
        await UserModel.findByIdAndUpdate(userId, { $push: { queries: newQuery._id } });
        res.json(newQuery);
    } catch (error) {
        console.error('Error saving queries:', error);
        res.status(500).json({ error: 'Failed to save queries' });
    }
};

// Получение запросов
const getArticleQueries = async (req, res) => {
    try {
        const userId = req.userId;

        // Если userId равен "admin", возвращаем пустой массив или пропускаем запрос
        if (userId === 'admin') {
            return res.json([]);
        }

        const queries = await QueryArticleModel.find({ userId }).sort({ createdAt: -1 });
        res.json(queries);
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.status(500).json({ error: 'Failed to fetch queries' });
    }
};

// Удаление запроса
const deleteArticleQuery = async (req, res) => {
    try {
        const queryId = req.params.id;
        const userId = req.userId;

        const deletedQuery = await QueryArticleModel.findOneAndDelete({ _id: queryId, userId });
        if (!deletedQuery) {
            return res.status(404).json({ error: 'Запрос не найден' });
        }

        await UserModel.findByIdAndUpdate(userId, { $pull: { queries: queryId } });
        res.json({ message: 'Запрос успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления запроса:', error);
        res.status(500).json({ error: 'Ошибка удаления запроса' });
    }
};


// Экспорт в Google Таблицы
const exportToGoogleSheet = async (req, res) => {
    const { queryId, sheetName } = req.body;
    const userId = req.userId;
    try {
        const query = await QueryArticleModel.findOne({ _id: queryId, userId }).populate('productTables.products');
        if (!query) {
            return res.status(404).json({ error: 'Запрос не найден' });
        }
        const user = await UserModel.findById(userId);
        if (!user || !user.spreadsheetId) {
            return res.status(404).json({ error: 'Пользователь или Google Таблица не найдены' });
        }
        const data = query.productTables.flatMap((table) =>
            table.products.map((product) => {
                const position = product?.page && product.page > 1
                    ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                    : String(product?.position);

                const promoPosition = product?.log?.promoPosition
                    ? `${position}*`
                    : position;

                return [
                    String(product?.query || query.query),
                    String(product?.id),
                    String(product?.city || query.city),
                    String(product?.imageUrl),
                    String(product?.brand),
                    String(product?.name),
                    promoPosition,
                    new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                    new Date(product?.queryTime || query.createdAt).toLocaleDateString(),
                ];
            })
        );
        await addDataToSheet(user.spreadsheetId, sheetName, data, true); // Передаем флаг для звёздочки
        res.json({ message: 'Данные успешно выгружены' });
    } catch (error) {
        console.error('Ошибка выгрузки данных:', error);
        res.status(500).json({ error: 'Ошибка выгрузки данных' });
    }
};

const exportAllToGoogleSheet = async (req, res) => {
    const userId = req.userId;
    try {
        const queries = await QueryArticleModel.find({ userId }).populate('productTables.products');
        const user = await UserModel.findById(userId);

        if (!user || !user.spreadsheetId) {
            return res.status(404).json({ error: 'Пользователь или Google Таблица не найдены' });
        }

        const result = await exportAllDataToSheet(user.spreadsheetId, queries, false);
        res.json(result);
    } catch (error) {
        console.error('Ошибка выгрузки всех данных:', error);
        res.status(500).json({ error: 'Ошибка выгрузки всех данных' });
    }
};

// Экспорт в Excel
const exportToExcel = async (req, res) => {
    let tempFilePath;

    try {
        const userId = req.userId;
        const fileName = `PosWB_${formatLocalDateTime(new Date())}.xlsx`;

        tempFilePath = await generateExcelForUser(userId);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const fileStream = fs.createReadStream(tempFilePath);
        fileStream.pipe(res);

        fileStream.on('end', () => {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        });

        fileStream.on('error', (error) => {
            console.error('Ошибка при отправке файла:', error);
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            if (!res.headersSent) {
                res.status(500).json({ error: 'Ошибка при отправке файла' });
            }
        });

    } catch (error) {
        console.error('Ошибка выгрузки данных:', error);
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        if (!res.headersSent) {
            res.status(500).json({ error: 'Ошибка выгрузки данных' });
        }
    }
};

// Новая функция для форматирования локальной даты и времени
function formatLocalDateTime(date) {
    const pad = (num) => num.toString().padStart(2, '0');

    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        '_',
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
    ].join('');
}

// Удаление запросов по параметрам (запрос, артикул, город)
const deleteArticleQueriesByParams = async (req, res) => {
    try {
        const { query, article, city } = req.body;
        const userId = req.userId;

        if (!query || !article || !city) {
            return res.status(400).json({ error: 'Необходимо указать запрос, артикул и город' });
        }

        // Находим все запросы пользователя, где есть совпадение
        const userQueries = await QueryArticleModel.find({ userId });
        let deletedCount = 0;

        // Обновляем каждый запрос, удаляя только совпадающие комбинации
        for (const q of userQueries) {
            const queries = q.query.split('; ');
            const articles = q.article.split('; ');
            const cities = q.city.split('; ');

            // Находим индексы совпадающих комбинаций
            const indexesToRemove = [];
            queries.forEach((qPart, i) => {
                if (qPart.toLowerCase() === query.toLowerCase() &&
                    (articles[i] || '').toLowerCase() === article.toLowerCase() &&
                    (cities[i] || '').toLowerCase() === city.toLowerCase()) {
                    indexesToRemove.push(i);
                }
            });

            if (indexesToRemove.length > 0) {
                // Удаляем совпадающие комбинации из всех массивов
                const newQueries = queries.filter((_, i) => !indexesToRemove.includes(i));
                const newArticles = articles.filter((_, i) => !indexesToRemove.includes(i));
                const newCities = cities.filter((_, i) => !indexesToRemove.includes(i));

                // Обновляем таблицы продуктов, удаляя соответствующие
                const newProductTables = q.productTables.filter((_, i) => !indexesToRemove.includes(i));

                if (newQueries.length === 0) {
                    // Если не осталось комбинаций - удаляем весь запрос
                    await q.deleteOne();
                    deletedCount++;
                } else {
                    // Обновляем запрос, оставляя только несовпадающие комбинации
                    q.query = newQueries.join('; ');
                    q.article = newArticles.join('; ');
                    q.city = newCities.join('; ');
                    q.productTables = newProductTables;
                    await q.save();
                    deletedCount += indexesToRemove.length;
                }
            }
        }

        res.json({
            message: `Удалено ${deletedCount} комбинаций запросов`,
            deletedCount
        });
    } catch (error) {
        console.error('Ошибка удаления запросов:', error);
        res.status(500).json({ error: 'Ошибка удаления запросов' });
    }
};

module.exports = {
    createArticleQuery,
    getArticleQueries,
    deleteArticleQuery,
    exportToGoogleSheet,
    exportAllToGoogleSheet,
    exportToExcel,
    deleteArticleQueriesByParams
};