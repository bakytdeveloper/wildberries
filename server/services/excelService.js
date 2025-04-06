const ExcelJS = require('exceljs');
const axios = require('axios');
const {QueryArticleModel} = require("../models/queryArticleModel");
const {QueryModel} = require("../models/queryModel");

// Функция для загрузки изображения по URL с улучшенной обработкой ошибок
const downloadImage = async (url) => {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            validateStatus: function (status) {
                return status >= 200 && status < 300; // Принимать только успешные статусы
            }
        });
        return Buffer.from(response.data, 'binary');
    } catch (error) {
        console.error('Ошибка загрузки изображения:', error.message);
        return null;
    }
};

const generateExcelForUser = async (userId) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheetBrand = workbook.addWorksheet('Бренд');
        const sheetArticle = workbook.addWorksheet('Артикул');

        // Заголовки для страницы "Бренд"
        sheetBrand.addRow([
            'Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса'
        ]);

        // Заголовки для страницы "Артикул"
        sheetArticle.addRow([
            'Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса'
        ]);

        // Получаем все запросы пользователя
        const brandQueries = await QueryModel.find({ userId }).populate('productTables.products');
        const articleQueries = await QueryArticleModel.find({ userId }).populate('productTables.products');

        // Добавляем данные для брендов
        for (const query of brandQueries) {
            for (const table of query.productTables) {
                for (const product of table.products) {
                    const position = product?.page && product.page > 1
                        ? `${product.page}${product.position < 10 ? '0' + product.position : product.position}`
                        : String(product?.position);

                    const hasPromo = !!product?.log?.promoPosition;
                    const promoPosition = hasPromo
                        ? `${product?.log?.promoPosition}*`
                        : position;

                    const rowData = [
                        String(product?.query || query.query),
                        String(product?.brand || query.brand),
                        String(product?.city || query.city),
                        product?.imageUrl || '', // Пустая строка, если нет URL изображения
                        String(product?.id),
                        String(product?.name),
                        promoPosition,
                        new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                        new Date(product?.queryTime || query.createdAt).toLocaleDateString(),
                    ];

                    const row = sheetBrand.addRow(rowData);

                    // Форматирование позиции со звёздочкой
                    if (hasPromo) {
                        const positionCell = row.getCell(7);
                        const numValue = product?.log?.promoPosition;

                        positionCell.value = {
                            richText: [
                                { text: String(numValue) },
                                { text: '*', font: { bold: true, color: { argb: 'FFD15E00' } } }
                            ]
                        };

                        positionCell.font = {
                            bold: true,
                            color: { argb: 'FFFF0000' }
                        };
                    }

                    // Добавляем изображение, если URL существует и изображение успешно загружено
                    if (product?.imageUrl) {
                        try {
                            const imageBuffer = await downloadImage(product.imageUrl);
                            if (imageBuffer) {
                                const imageId = workbook.addImage({
                                    buffer: imageBuffer,
                                    extension: product.imageUrl.endsWith('.png') ? 'png' : 'jpeg',
                                });
                                sheetBrand.addImage(imageId, {
                                    tl: { col: 3, row: row.number - 1, offset: 5 },
                                    ext: { width: 30, height: 30 },
                                });
                                sheetBrand.getRow(row.number).height = 30;
                            }
                        } catch (error) {
                            console.error(`Не удалось добавить изображение для продукта ${product.id}:`, error.message);
                            // Оставляем ячейку пустой
                        }
                    }
                }
            }
        }

        // Добавляем данные для артикулов
        for (const query of articleQueries) {
            for (const table of query.productTables) {
                for (const product of table.products) {
                    const position = product?.page && product.page > 1
                        ? `${product.page}${product.position < 10 ? '0' + product.position : product.position}`
                        : String(product?.position);

                    const hasPromo = !!product?.log?.promoPosition;
                    const promoPosition = hasPromo
                        ? `${product?.log?.promoPosition}*`
                        : position;

                    const rowData = [
                        String(product?.query || query.query),
                        String(product?.id),
                        String(product?.city || query.city),
                        product?.imageUrl || '', // Пустая строка, если нет URL изображения
                        String(product?.brand),
                        String(product?.name),
                        promoPosition,
                        new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                        new Date(product?.queryTime || query.createdAt).toLocaleDateString(),
                    ];

                    const row = sheetArticle.addRow(rowData);

                    // Форматирование позиции со звёздочкой
                    if (hasPromo) {
                        const positionCell = row.getCell(7);
                        const numValue = product?.log?.promoPosition;

                        positionCell.value = {
                            richText: [
                                { text: String(numValue) },
                                { text: '*', font: { bold: true, color: { argb: 'FFD15E00' } } }
                            ]
                        };

                        positionCell.font = {
                            bold: true,
                            color: { argb: 'FFFF0000' }
                        };
                    }

                    // Добавляем изображение, если URL существует и изображение успешно загружено
                    if (product?.imageUrl) {
                        try {
                            const imageBuffer = await downloadImage(product.imageUrl);
                            if (imageBuffer) {
                                const imageId = workbook.addImage({
                                    buffer: imageBuffer,
                                    extension: product.imageUrl.endsWith('.png') ? 'png' : 'jpeg',
                                });
                                sheetArticle.addImage(imageId, {
                                    tl: { col: 3, row: row.number - 1, offset: 5 },
                                    ext: { width: 30, height: 30 },
                                });
                                sheetArticle.getRow(row.number).height = 30;
                            }
                        } catch (error) {
                            console.error(`Не удалось добавить изображение для продукта ${product.id}:`, error.message);
                            // Оставляем ячейку пустой
                        }
                    }
                }
            }
        }

        // Генерируем буфер Excel
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    } catch (error) {
        console.error('Ошибка генерации Excel:', error);
        throw error;
    }
};

module.exports = {
    generateExcelForUser
};