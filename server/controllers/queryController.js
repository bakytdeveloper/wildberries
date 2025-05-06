const fs = require("fs");
const {QueryArticleModel} = require("../models/queryArticleModel");
const {streamExcelForUser} = require("../services/excelService");
const {exportAllDataToSheet} = require("../services/googleSheetService");
const {generateExcelForUser} = require("../services/excelService");
const {createExcelFileOnDemand} = require("../services/excelService");
const { QueryModel } = require('../models/queryModel');
const { fetchAndParseProducts } = require('../services/productService');
const { UserModel } = require('../models/userModel');
const { addDataToSheet } = require('../services/googleSheetService');
const path = require('path');

// Получение всех запросов
const getQueries = async (req, res) => {
    try {
        const userId = req.userId;

        if (userId === 'admin') {
            return res.json([]);
        }

        const queries = await QueryModel.find({ userId }).sort({ createdAt: -1 });
        res.json(queries);
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.status(500).json({ error: 'Не удалось получить запросы' });
    }
};

// Создание нового запроса
const createQuery = async (req, res) => {
    const { forms } = req.body;
    const userId = req.userId;

    if (!forms || !Array.isArray(forms) || forms.length === 0) {
        res.status(400).json({ error: 'Неверный формат запроса' });
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
        res.status(500).json({ error: 'Не удалось сохранить запросы' });
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
                const position = product?.page && product.page > 1
                    ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                    : String(product?.position);

                const promoPosition = product?.log?.promoPosition
                    ? `${position}*`
                    : position;

                return [
                    String(product?.query || query.query),
                    String(product?.brand || query.brand),
                    String(product?.city || query.city),
                    String(product?.imageUrl),
                    String(product?.id),
                    String(product?.name),
                    promoPosition,
                    new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                    new Date(product?.queryTime || query.createdAt).toLocaleDateString(),
                ];
            })
        );
        await addDataToSheet(user.spreadsheetId, sheetName, data, true);
        res.json({ message: 'Данные успешно выгружены' });
    } catch (error) {
        console.error('Ошибка выгрузки данных:', error);
        res.status(500).json({ error: 'Ошибка выгрузки данных' });
    }
};

const exportAllToGoogleSheet = async (req, res) => {
    const userId = req.userId;
    try {
        const queries = await QueryModel.find({ userId }).populate('productTables.products');
        const user = await UserModel.findById(userId);

        if (!user || !user.spreadsheetId) {
            return res.status(404).json({ error: 'Пользователь или Google Таблица не найдены' });
        }

        const result = await exportAllDataToSheet(user.spreadsheetId, queries, true);
        res.json(result);
    } catch (error) {
        console.error('Ошибка выгрузки всех данных:', error);
        res.status(500).json({ error: 'Ошибка выгрузки всех данных' });
    }
};

// Экспорт в Excel с поддержкой ZIP
const exportToExcel = async (req, res) => {
    let tempFilePath;

    try {
        const userId = req.userId;
        const fileName = `PosWB_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;

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


module.exports = {
    getQueries,
    createQuery,
    deleteQuery,
    exportToGoogleSheet,
    exportAllToGoogleSheet,
    exportToExcel
};