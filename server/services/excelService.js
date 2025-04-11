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
            // console.warn(`Повторная попытка загрузки изображения (${retries} осталось): ${url}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return downloadImage(url, retries - 1);
        }
        console.error(`Не удалось загрузить изображение после 3 попыток: ${url}`);
        return null;
    }
};

// Функция обработки изображений батчами
const processImagesInBatches = async (items, batchSize, processFunction) => {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(processFunction));
    }
};

const generateExcelForUser = async (userId) => {
    try {
        const workbook = new ExcelJS.Workbook();

        // Создаем листы с разными заголовками
        const sheetBrand = workbook.addWorksheet('Бренд');
        const sheetArticle = workbook.addWorksheet('Артикул');

        // Заголовки для страницы "Бренд"
        const brandHeaders = [
            'Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул',
            'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса'
        ];
        sheetBrand.addRow(brandHeaders);

        // Заголовки для страницы "Артикул"
        const articleHeaders = [
            'Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд',
            'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса'
        ];
        sheetArticle.addRow(articleHeaders);

        // Получаем данные
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId }).populate('productTables.products'),
            QueryArticleModel.find({ userId }).populate('productTables.products')
        ]);

        const processImage = async (sheet, rowIndex, imageUrl) => {
            if (!imageUrl) return;

            try {
                const imageBuffer = await downloadImage(imageUrl);
                if (imageBuffer) {
                    const extension = imageUrl.endsWith('.png') ? 'png' : 'jpeg';
                    const imageId = workbook.addImage({ buffer: imageBuffer, extension });

                    sheet.addImage(imageId, {
                        tl: { col: 3, row: rowIndex - 1, offset: 5 },
                        ext: { width: 30, height: 30 }
                    });

                    sheet.getRow(rowIndex).height = 30;
                }
            } catch (error) {
                console.error(`Ошибка обработки изображения для ${imageUrl}:`, error.message);
            }
        };

        // Обработка данных по брендам
        const processBrandData = async () => {
            const brandTasks = [];
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
                            product?.imageUrl || '',
                            product?.id,
                            product?.name,
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                        ];

                        const row = sheetBrand.addRow(rowData);
                        if (promoPosition.includes('*')) {
                            const positionCell = row.getCell(7);
                            positionCell.font = {
                                bold: true,
                                color: { argb: 'FFFF0000' }
                            };
                        }

                        brandTasks.push(async () => processImage(sheetBrand, row.number, product?.imageUrl));
                    }
                }
            }
            await processImagesInBatches(brandTasks, 20, task => task());
        };

        // Обработка данных по артикулам
        const processArticleData = async () => {
            const articleTasks = [];
            for (const query of articleQueries) {
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
                            product?.id,
                            product?.city || query.city,
                            product?.imageUrl || '',
                            product?.brand,
                            product?.name,
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                        ];

                        const row = sheetArticle.addRow(rowData);
                        if (promoPosition.includes('*')) {
                            const positionCell = row.getCell(7);
                            positionCell.font = {
                                bold: true,
                                color: { argb: 'FFFF0000' }
                            };
                        }

                        articleTasks.push(async () => processImage(sheetArticle, row.number, product?.imageUrl));
                    }
                }
            }
            await processImagesInBatches(articleTasks, 20, task => task());
        };

        await Promise.all([processBrandData(), processArticleData()]);

        // Настраиваем ширину колонок для лучшего отображения
        sheetBrand.columns = [
            { width: 30 }, // Запрос
            { width: 20 }, // Бренд
            { width: 15 }, // Город
            { width: 15 }, // Картинка
            { width: 15 }, // Артикул
            { width: 50 }, // Описание товара
            { width: 15 }, // Позиция
            { width: 15 }, // Время запроса
            { width: 15 }  // Дата запроса
        ];

        sheetArticle.columns = [
            { width: 30 }, // Запрос
            { width: 15 }, // Артикул
            { width: 15 }, // Город
            { width: 15 }, // Картинка
            { width: 20 }, // Бренд
            { width: 50 }, // Описание товара
            { width: 15 }, // Позиция
            { width: 15 }, // Время запроса
            { width: 15 }  // Дата запроса
        ];

        return workbook.xlsx.writeBuffer();
    } catch (error) {
        console.error('Ошибка создания Excel:', error);
        throw error;
    }
};

module.exports = { generateExcelForUser };