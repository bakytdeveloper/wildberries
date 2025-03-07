import { Request, Response } from 'express';
import { QueryModel } from '../models/queryModel';
import { fetchAndParseProducts } from '../services/productService';
import {UserModel} from "../models/userModel";
import {logging_v2} from "googleapis";
import {addDataToSheet} from "../services/googleSheetService";

export const getQueries = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId; // Получаем идентификатор пользователя из запроса
        const queries = await QueryModel.find({ userId }).sort({ createdAt: -1 });
        res.json(queries);  // Отправляем JSON ответ
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.status(500).json({ error: 'Failed to fetch queries' });
    }
};

export const createQuery = async (req: Request, res: Response) => {
    const { forms } = req.body;
    const userId = (req as any).userId; // Получаем идентификатор пользователя из запроса

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
            userId, // Сохраняем идентификатор пользователя
            query: forms.map(form => form.query).join('; '),
            dest: forms.map(form => form.dest).join('; '),
            productTables,
            createdAt: new Date(forms[0].queryTime),
            city: forms.map(form => form.city).join('; '),
            brand: forms.map(form => form.brand).join('; ')
        });

        await newQuery.save();

        // Добавляем запрос в массив запросов пользователя
        await UserModel.findByIdAndUpdate(userId, { $push: { queries: newQuery._id } });

        res.json(newQuery);
    } catch (error) {
        console.error('Error saving queries:', error);
        res.status(500).json({ error: 'Failed to save queries' });
    }
};

// queryController.ts

export const deleteQuery = async (req: Request, res: Response) => {
    try {
        const queryId = req.params.id;
        const userId = (req as any).userId; // Получаем идентификатор пользователя из запроса

        // Удаляем запрос из базы данных
        const deletedQuery = await QueryModel.findOneAndDelete({ _id: queryId, userId });

        if (!deletedQuery) {
            return res.status(404).json({ error: 'Запрос не найден' });
        }

        // Удаляем запрос из массива запросов пользователя
        await UserModel.findByIdAndUpdate(userId, { $pull: { queries: queryId } });

        res.json({ message: 'Запрос успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления запроса:', error);
        res.status(500).json({ error: 'Ошибка удаления запроса' });
    }
};


// Экспорт данных в Google Таблицу
export const exportToGoogleSheet = async (req: Request, res: Response) => {
    const { queryId, sheetName } = req.body; // получаем идентификатор запроса и имя листа
    const userId = (req as any).userId;
    try {
        const query = await QueryModel.findOne({ _id: queryId, userId }).populate('productTables.products');
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
                const promoPosition = product?.log?.promoPosition ??
                    (product?.page && product.page > 1
                        ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                        : String(product?.position));

                // Логика для position
                const position = product?.log?.position ??
                    (product?.page && product.page > 1
                        ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                        : String(product?.position));

                return [
                    String(product?.query || query.query), // Запрос (из продукта или из верхнего уровня)
                    String(product?.brand || query.brand), // Бренд (из продукта или из верхнего уровня)
                    String(product?.city || query.city), // Город (из продукта или из верхнего уровня)
                    String(product?.imageUrl), // Изображение
                    String(product?.id),
                    String(product?.name), // Наименование
                    promoPosition, // Позиция (из log или page:position)
                    position, // Прежняя позиция (из log или page:position)
                    new Date(product?.queryTime || query.createdAt).toLocaleTimeString(), // Время запроса
                    new Date(product?.queryTime || query.createdAt).toLocaleDateString(), // Дата запроса
                ];
            })
        );

        // Логируем данные перед отправкой
        console.log('DATA:', data);

        // Добавляем данные в Google Таблицу
        await addDataToSheet(user.spreadsheetId, sheetName, data);
        res.json({ message: 'Данные успешно выгружены' });
    } catch (error) {
        console.error('Ошибка выгрузки данных:', error);
        res.status(500).json({ error: 'Ошибка выгрузки данных' });
    }
};