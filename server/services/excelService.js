const ExcelJS = require('exceljs');
const axios = require('axios');
const { QueryArticleModel } = require("../models/queryArticleModel");
const { QueryModel } = require("../models/queryModel");

// Улучшенная функция загрузки изображений с повторными попытками
const downloadImage = async (url, retries = 3) => {
    if (!url) return null;

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 5000, // Таймаут 5 секунд
            validateStatus: (status) => status === 200 // Принимаем только статус 200
        });

        return Buffer.from(response.data, 'binary');
    } catch (error) {
        if (retries > 0) {
            console.warn(`Retrying image download (${retries} left): ${url}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return downloadImage(url, retries - 1);
        }
        console.error(`Failed to download image after 3 attempts: ${url}`);
        return null;
    }
};

const generateExcelForUser = async (userId) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheetBrand = workbook.addWorksheet('Бренд');
        const sheetArticle = workbook.addWorksheet('Артикул');

        // Заголовки таблиц
        const headers = [
            'Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул',
            'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса'
        ];
        sheetBrand.addRow(headers);
        sheetArticle.addRow([headers[0], 'Артикул', ...headers.slice(2)]);

        // Получаем данные
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId }).populate('productTables.products'),
            QueryArticleModel.find({ userId }).populate('productTables.products')
        ]);

        // Функция для обработки изображений
        const processImage = async (sheet, row, imageUrl) => {
            if (!imageUrl) return;

            try {
                const imageBuffer = await downloadImage(imageUrl);
                if (imageBuffer) {
                    const extension = imageUrl.endsWith('.png') ? 'png' : 'jpeg';
                    const imageId = workbook.addImage({ buffer: imageBuffer, extension });

                    sheet.addImage(imageId, {
                        tl: { col: 3, row: row.number - 1, offset: 5 },
                        ext: { width: 30, height: 30 }
                    });

                    sheet.getRow(row.number).height = 30;
                }
            } catch (error) {
                console.error(`Image processing error for ${imageUrl}:`, error.message);
            }
        };

        // Обработка данных по брендам
        for (const query of brandQueries) {
            for (const table of query.productTables) {
                for (const product of table.products) {
                    const position = product?.page > 1
                        ? `${product.page}${String(product.position).padStart(2, '0')}`
                        : String(product?.position || '');

                    const promoPosition = product?.log?.promoPosition
                        ? `${product.log.promoPosition}*`
                        : position;

                    const rowData = [
                        product?.query || query.query,
                        product?.brand || query.brand,
                        product?.city || query.city,
                        product?.imageUrl || '', // URL для возможного ручного просмотра
                        product?.id,
                        product?.name,
                        promoPosition,
                        new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                        new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                    ];

                    const row = sheetBrand.addRow(rowData);
                    // Форматируем ячейку с позицией, если есть звёздочка
                    if (promoPosition.includes('*')) {
                        const positionCell = row.getCell(7); // 7-я колонка (G) - Позиция
                        positionCell.font = {
                            bold: true,
                            color: { argb: 'FFFF0000' } // Красный цвет
                        };
                    }

                    await processImage(sheetBrand, row, product?.imageUrl);
                }
            }
        }

        // Обработка данных по артикулам (аналогично)
        for (const query of articleQueries) {
            for (const table of query.productTables) {
                for (const product of table.products) {
                    const position = product?.page > 1
                        ? `${product.page}${String(product.position).padStart(2, '0')}`
                        : String(product?.position || '');
                    const hasPromo = !!product?.log?.promoPosition;
                    const rowData = [
                        product?.query || query.query,
                        product?.id,
                        product?.city || query.city,
                        product?.imageUrl || '',
                        product?.brand,
                        product?.name,
                        product?.log?.promoPosition ? `${product.log.promoPosition}*` : position,
                        new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                        new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                    ];

                    const row = sheetArticle.addRow(rowData);
                    // Форматируем ячейку с позицией, если есть звёздочка
                    if (hasPromo) {
                        const positionCell = row.getCell(7);
                        const numValue = product?.log?.promoPosition;
                        positionCell.value = {
                            richText: [ { text: String(numValue) },
                                { text: '*',
                                    font: {
                                        bold: true,
                                        color: {
                                            argb: 'FFD15E00' } } } ] };
                        positionCell.font = {
                            bold: true,
                            color: { argb: 'FFFF0000' } }; }
                    await processImage(sheetArticle, row, product?.imageUrl);
                }
            }
        }

        return workbook.xlsx.writeBuffer();
    } catch (error) {
        console.error('Excel generation error:', error);
        throw error;
    }
};

module.exports = { generateExcelForUser };