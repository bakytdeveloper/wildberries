const { QueryModel } = require('../models/queryModel');
const { fetchAndParseProducts } = require('../services/productService');
const { UserModel } = require('../models/userModel');
const { addDataToSheet } = require('../services/googleSheetService');

// Получение всех запросов
const getQueries = async (req, res) => {
    try {
        const userId = req.userId; // Получаем идентификатор пользователя из запроса
        const queries = await QueryModel.find({ userId }).sort({ createdAt: -1 });
        res.json(queries); // Отправляем JSON ответ
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.status(500).json({ error: 'Failed to fetch queries' });
    }
};

// Создание нового запроса
const createQuery = async (req, res) => {
    const { forms } = req.body;
    const userId = req.userId; // Получаем идентификатор пользователя из запроса

    if (!forms || !Array.isArray(forms) || forms.length === 0) {
        res.status(400).json({ error: 'Invalid request format' });
        return;
    }

    try {
        const productTables = await Promise.all(forms.map(async (form) => {
            const products = await fetchAndParseProducts(form.query, form.dest, form.brand, form.queryTime);
            return { tableId: form.id, products };
        }));

        const newQuery = new QueryModel({
            userId,
            query: forms.map(form => form.query).join('; '),
            dest: forms.map(form => form.dest).join('; '),
            productTables,
            createdAt: new Date(forms[0].queryTime),
            city: forms.map(form => form.city).join('; '),
            brand: forms.map(form => form.brand).join('; ')
        });

        await newQuery.save();
        await UserModel.findByIdAndUpdate(userId, { $push: { queries: newQuery._id } });

        res.json(newQuery);
    } catch (error) {
        console.error('Error saving queries:', error);
        res.status(500).json({ error: 'Failed to save queries' });
    }
};

// Удаление запроса
const deleteQuery = async (req, res) => {
    try {
        const queryId = req.params.id;
        const userId = req.userId;

        const deletedQuery = await QueryModel.findOneAndDelete({ _id: queryId, userId });
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

// Экспорт данных в Google Таблицу
const exportToGoogleSheet = async (req, res) => {
    const { queryId, sheetName } = req.body;
    const userId = req.userId;

    try {
        const query = await QueryModel.findOne({ _id: queryId, userId }).populate('productTables.products');
        if (!query) {
            return res.status(404).json({ error: 'Запрос не найден' });
        }

        const user = await UserModel.findById(userId);
        if (!user || !user.spreadsheetId) {
            return res.status(404).json({ error: 'Пользователь или Google Таблица не найдены' });
        }

        const data = query.productTables.flatMap((table) =>
            table.products.map((product) => {
                const promoPosition = product?.log?.promoPosition ??
                    (product?.page && product.page > 1
                        ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                        : String(product?.position));

                const position = product?.log?.position ??
                    (product?.page && product.page > 1
                        ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                        : String(product?.position));

                return [
                    String(product?.query || query.query),
                    String(product?.brand || query.brand),
                    String(product?.city || query.city),
                    String(product?.imageUrl),
                    String(product?.id),
                    String(product?.name),
                    promoPosition,
                    position,
                    new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                    new Date(product?.queryTime || query.createdAt).toLocaleDateString(),
                ];
            })
        );

        await addDataToSheet(user.spreadsheetId, sheetName, data);
        res.json({ message: 'Данные успешно выгружены' });
    } catch (error) {
        console.error('Ошибка выгрузки данных:', error);
        res.status(500).json({ error: 'Ошибка выгрузки данных' });
    }
};

module.exports = {
    getQueries,
    createQuery,
    deleteQuery,
    exportToGoogleSheet
};
