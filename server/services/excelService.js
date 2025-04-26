const ExcelJS = require('exceljs');
const axios = require('axios');
const { QueryArticleModel } = require("../models/queryArticleModel");
const { QueryModel } = require("../models/queryModel");

// Конфигурация
const CONFIG = {
    IMAGE: {
        TIMEOUT: 15000,
        RETRIES: 3,
        RETRY_DELAY: 1000,
        BATCH_SIZE: 10,
        SIZE: { width: 30, height: 30 }
    },
    DATABASE: {
        TIMEOUT: 30000
    },
    STREAM: {
        CHUNK_SIZE: 100
    }
};

// Улучшенная загрузка изображений
const downloadImage = async (url) => {
    if (!url) return null;

    for (let attempt = 1; attempt <= CONFIG.IMAGE.RETRIES; attempt++) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: CONFIG.IMAGE.TIMEOUT,
                validateStatus: (status) => status === 200
            });
            return Buffer.from(response.data, 'binary');
        } catch (error) {
            if (attempt === CONFIG.IMAGE.RETRIES) {
                console.error(`Не удалось загрузить изображение: ${url}`);
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, CONFIG.IMAGE.RETRY_DELAY));
        }
    }
};

// Обработка изображений батчами
const processImagesBatch = async (tasks) => {
    const results = await Promise.allSettled(
        tasks.map(task => task())
    );
    return results.filter(r => r.status === 'fulfilled').map(r => r.value);
};

// Создание строки данных
const createRowData = (product, query, isBrandSheet) => {
    const position = product?.page > 1
        ? `${product.page}${String(product.position).padStart(2, '0')}`
        : String(product?.position || '');

    const promoPosition = product?.log?.promoPosition
        ? `${product.log.promoPosition}*`
        : position;

    return {
        data: [
            product?.query || query.query,
            isBrandSheet ? product?.brand || query.brand : product?.id,
            product?.city || query.city,
            product?.imageUrl || '',
            isBrandSheet ? product?.id : product?.brand,
            product?.name,
            promoPosition,
            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
            new Date(product?.queryTime || query.createdAt).toLocaleDateString()
        ],
        isPromo: promoPosition.includes('*'),
        imageUrl: product?.imageUrl
    };
};

// Генерация Excel (обычный режим)
const generateExcelForUser = async (userId) => {
    const workbook = new ExcelJS.Workbook();
    workbook.calcProperties.fullCalcOnLoad = false;

    try {
        const [sheetBrand, sheetArticle] = [
            workbook.addWorksheet('Бренд'),
            workbook.addWorksheet('Артикул')
        ];

        // Заголовки
        sheetBrand.addRow(['Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);
        sheetArticle.addRow(['Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);

        // Получение данных
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId }).populate('productTables.products').maxTimeMS(CONFIG.DATABASE.TIMEOUT),
            QueryArticleModel.find({ userId }).populate('productTables.products').maxTimeMS(CONFIG.DATABASE.TIMEOUT)
        ]);

        // Обработка данных
        const processData = async (queries, sheet, isBrandSheet) => {
            const imageTasks = [];

            for (const query of queries) {
                for (const table of query.productTables) {
                    for (const product of table.products) {
                        const { data, isPromo, imageUrl } = createRowData(product, query, isBrandSheet);
                        const row = sheet.addRow(data);

                        if (isPromo) {
                            row.getCell(7).font = { bold: true, color: { argb: 'FFFF0000' } };
                        }

                        if (imageUrl) {
                            imageTasks.push(async () => {
                                const imageBuffer = await downloadImage(imageUrl);
                                if (imageBuffer) {
                                    const extension = imageUrl.split('.').pop() === 'png' ? 'png' : 'jpeg';
                                    const imageId = workbook.addImage({ buffer: imageBuffer, extension });

                                    sheet.addImage(imageId, {
                                        tl: { col: 3, row: row.number - 1, offset: 5 },
                                        ext: CONFIG.IMAGE.SIZE
                                    });

                                    sheet.getRow(row.number).height = CONFIG.IMAGE.SIZE.height;
                                }
                            });
                        }
                    }
                }
            }

            // Обработка изображений батчами
            for (let i = 0; i < imageTasks.length; i += CONFIG.IMAGE.BATCH_SIZE) {
                const batch = imageTasks.slice(i, i + CONFIG.IMAGE.BATCH_SIZE);
                await processImagesBatch(batch);
            }
        };

        await Promise.all([
            processData(brandQueries, sheetBrand, true),
            processData(articleQueries, sheetArticle, false)
        ]);

        // Настройка колонок
        sheetBrand.columns = [
            { width: 30 }, { width: 20 }, { width: 15 },
            { width: 15 }, { width: 15 }, { width: 50 },
            { width: 15 }, { width: 15 }, { width: 15 }
        ];

        sheetArticle.columns = [
            { width: 30 }, { width: 15 }, { width: 15 },
            { width: 15 }, { width: 20 }, { width: 50 },
            { width: 15 }, { width: 15 }, { width: 15 }
        ];

        return workbook.xlsx.writeBuffer();
    } catch (error) {
        console.error('Ошибка создания Excel:', error);
        throw error;
    }
};

// Потоковая генерация Excel
const streamExcelForUser = async (userId, res) => {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: true
    });

    try {
        const [sheetBrand, sheetArticle] = [
            workbook.addWorksheet('Бренд'),
            workbook.addWorksheet('Артикул')
        ];

        // Заголовки
        sheetBrand.addRow(['Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);
        sheetArticle.addRow(['Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);

        // Получение данных
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId }).populate('productTables.products').maxTimeMS(CONFIG.DATABASE.TIMEOUT),
            QueryArticleModel.find({ userId }).populate('productTables.products').maxTimeMS(CONFIG.DATABASE.TIMEOUT)
        ]);

        // Обработка данных потоком
        const processStreamData = async (queries, sheet, isBrandSheet) => {
            let rowCount = 0;

            for (const query of queries) {
                for (const table of query.productTables) {
                    for (const product of table.products) {
                        const { data, isPromo } = createRowData(product, query, isBrandSheet);
                        const row = sheet.addRow(data);

                        if (isPromo) {
                            row.getCell(7).font = { bold: true, color: { argb: 'FFFF0000' } };
                        }

                        rowCount++;
                        if (rowCount % CONFIG.STREAM.CHUNK_SIZE === 0) {
                            await sheet.commit();
                        }
                    }
                }
            }
            await sheet.commit();
        };

        await Promise.all([
            processStreamData(brandQueries, sheetBrand, true),
            processStreamData(articleQueries, sheetArticle, false)
        ]);

        // Финализация
        await workbook.commit();
    } catch (error) {
        console.error('Ошибка потоковой генерации Excel:', error);
        if (!res.headersSent) {
            res.status(500).end();
        }
        throw error;
    }
};

module.exports = { generateExcelForUser, streamExcelForUser };