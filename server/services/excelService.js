const ExcelJS = require('exceljs');
const axios = require('axios');
const { QueryArticleModel } = require("../models/queryArticleModel");
const { QueryModel } = require("../models/queryModel");
const imageCache = new Map();

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
// Обновить функцию downloadImage
const downloadImage = async (url) => {
    if (!url) return null;

    // Проверка кэша
    if (imageCache.has(url)) {
        return imageCache.get(url);
    }

    for (let attempt = 1; attempt <= CONFIG.IMAGE.RETRIES; attempt++) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: CONFIG.IMAGE.TIMEOUT,
                validateStatus: (status) => status === 200
            });
            const buffer = Buffer.from(response.data, 'binary');
            imageCache.set(url, buffer); // Кэширование
            return buffer;
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
        // Создаем листы с разными заголовками
        const sheetBrand = workbook.addWorksheet('Бренд');
        const sheetArticle = workbook.addWorksheet('Артикул');

        // Заголовки для страницы Бренд
        const brandHeaders = ['Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса'];
        sheetBrand.addRow(brandHeaders);

        // Заголовки для страницы Артикул
        const articleHeaders = ['Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса'];
        sheetArticle.addRow(articleHeaders);

        // Получение данных с пагинацией и оптимизацией памяти
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId })
                .select('query productTables city brand createdAt')
                .lean()
                .populate({
                    path: 'productTables.products',
                    options: { batchSize: 1000 }
                })
                .maxTimeMS(CONFIG.DATABASE.TIMEOUT),
            QueryArticleModel.find({ userId })
                .select('query productTables city article createdAt')
                .lean()
                .populate({
                    path: 'productTables.products',
                    options: { batchSize: 1000 }
                })
                .maxTimeMS(CONFIG.DATABASE.TIMEOUT)
        ]);

        // Очистка кэша изображений перед обработкой
        imageCache.clear();

        // Обработка данных с защитой от утечек памяти
        const processData = async (queries, sheet, isBrandSheet) => {
            const imageTasks = [];
            let processedRows = 0;

            for (const query of queries) {
                for (const table of query.productTables) {
                    // Обрабатываем продукты порциями для экономии памяти
                    for (let i = 0; i < table.products.length; i++) {
                        const product = table.products[i];
                        const { data, isPromo, imageUrl } = createRowData(product, query, isBrandSheet);
                        const row = sheet.addRow(data);

                        if (isPromo) {
                            row.getCell(7).font = { bold: true, color: { argb: 'FFFF0000' } };
                        }

                        if (imageUrl) {
                            imageTasks.push(async () => {
                                try {
                                    const imageBuffer = await downloadImage(imageUrl);
                                    if (imageBuffer) {
                                        const extension = imageUrl.split('.').pop() === 'png' ? 'png' : 'jpeg';
                                        const imageId = workbook.addImage({
                                            buffer: imageBuffer,
                                            extension
                                        });

                                        sheet.addImage(imageId, {
                                            tl: { col: 3, row: row.number - 1, offset: 5 },
                                            ext: CONFIG.IMAGE.SIZE
                                        });

                                        sheet.getRow(row.number).height = CONFIG.IMAGE.SIZE.height;
                                    }
                                } catch (err) {
                                    console.error('Ошибка обработки изображения:', err);
                                }
                            });

                            // Обрабатываем изображения пачками
                            if (imageTasks.length >= CONFIG.IMAGE.BATCH_SIZE) {
                                await processImagesBatch(imageTasks.splice(0, CONFIG.IMAGE.BATCH_SIZE));
                                // Даем event loop возможность обработать другие события
                                await new Promise(resolve => setImmediate(resolve));
                            }
                        }

                        processedRows++;
                        // Периодически освобождаем память
                        if (processedRows % 500 === 0) {
                            await new Promise(resolve => setImmediate(resolve));
                        }
                    }
                }
            }

            // Обработка оставшихся изображений
            if (imageTasks.length > 0) {
                await processImagesBatch(imageTasks);
            }
        };

        // Обрабатываем данные параллельно
        await Promise.all([
            processData(brandQueries, sheetBrand, true),
            processData(articleQueries, sheetArticle, false)
        ]);

        // Установка ширины колонок с учетом разных заголовков
        const setColumnWidths = (sheet, isBrandSheet) => {
            sheet.columns = [
                { width: 30 }, // Запрос
                { width: isBrandSheet ? 20 : 15 }, // Бренд или Артикул
                { width: 15 }, // Город
                { width: 15 }, // Картинка
                { width: isBrandSheet ? 15 : 20 }, // Артикул или Бренд
                { width: 50 }, // Описание товара
                { width: 15 }, // Позиция
                { width: 15 }, // Время запроса
                { width: 15 }  // Дата запроса
            ];
        };

        setColumnWidths(sheetBrand, true);
        setColumnWidths(sheetArticle, false);

        // Финализация и очистка
        const buffer = await workbook.xlsx.writeBuffer();
        imageCache.clear(); // Очищаем кэш после использования

        return buffer;
    } catch (error) {
        // Гарантированная очистка ресурсов при ошибке
        imageCache.clear();
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