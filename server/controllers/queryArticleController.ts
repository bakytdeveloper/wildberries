import { Request, Response } from 'express';
import { QueryArticleModel } from '../models/queryArticleModel';
import { fetchAndParseProductsByArticle } from '../services/productService';
import { UserModel } from "../models/userModel";
import { addDataToSheet } from "../services/googleSheetService";

// Создание нового запроса
export const createArticleQuery = async (req: Request, res: Response) => {
    const { forms } = req.body;
    const userId = (req as any).userId;

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
export const getArticleQueries = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const queries = await QueryArticleModel.find({ userId }).sort({ createdAt: -1 });
        res.json(queries);
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.status(500).json({ error: 'Failed to fetch queries' });
    }
};

// Удаление запроса
export const deleteArticleQuery = async (req: Request, res: Response) => {
    try {
        const queryId = req.params.id;
        const userId = (req as any).userId;

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

export const exportToGoogleSheet = async (req: Request, res: Response) => {
    const { queryId, sheetName } = req.body; // получаем идентификатор запроса и имя листа
    const userId = (req as any).userId;
    try {
        const query = await QueryArticleModel.findOne({ _id: queryId, userId }).populate('productTables.products');
        if (!query) {
            return res.status(404).json({ error: 'Запрос не найден' });
        }
        const user = await UserModel.findById(userId);
        if (!user || !user.spreadsheetId) {
            return res.status(404).json({ error: 'Пользователь или Google Таблица не найдены' });
        }

        // Формируем данные для экспорта
        const data = query.productTables.flatMap((table) =>
            table.products.map((product) => {
                // Логика для promoPosition
                const promoPosition = product?.page && product.page > 1
                    ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                    : String(product?.position);

                // Логика для position
                const position = product?.page && product.page > 1
                    ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                    : String(product?.position);

                return [
                    String(product?.query || query.query), // Запрос (из продукта или из верхнего уровня)
                    String(product?.id), // Артикул
                    String(product?.city || query.city), // Город (из продукта или из верхнего уровня)
                    String(product?.imageUrl), // Изображение
                    String(product?.brand),
                    String(product?.name), // Наименование
                    promoPosition, // Позиция (из page:position)
                    position, // Прежняя позиция (из page:position)
                    new Date(product?.queryTime || query.createdAt).toLocaleTimeString(), // Время запроса
                    new Date(product?.queryTime || query.createdAt).toLocaleDateString(), // Дата запроса
                ];
            })
        );

        // Добавляем данные в Google Таблицу
        await addDataToSheet(user.spreadsheetId, sheetName, data);
        res.json({ message: 'Данные успешно выгружены' });
    } catch (error) {
        console.error('Ошибка выгрузки данных:', error);
        res.status(500).json({ error: 'Ошибка выгрузки данных' });
    }
};


