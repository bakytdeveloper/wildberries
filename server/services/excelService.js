const ExcelJS = require('exceljs');
const axios = require('axios');
const { QueryArticleModel } = require("../models/queryArticleModel");
const { QueryModel } = require("../models/queryModel");
const imageCache = new Map();

// Усиленная конфигурация
const CONFIG = {
    IMAGE: {
        TIMEOUT: 5000, // Уменьшен таймаут
        RETRIES: 2,     // Уменьшено количество попыток
        RETRY_DELAY: 300,
        BATCH_SIZE: 10, // Увеличен размер батча
        SIZE: { width: 30, height: 30 },
        CONCURRENCY: 10  // Ограничение параллельных загрузок
    },
    DATABASE: {
        TIMEOUT: 30000, // Увеличьте с 20000
        BATCH_SIZE: 100  // Уменьшите с 200
    },
    EXCEL: {
        STREAMING: false, // Использование потокового режима
        USE_SHARED_STRINGS: false // Отключение shared strings для производительности
    }
};

// Оптимизированная загрузка изображений с ограничением concurrency
const downloadImage = async (url) => {
    if (!url) return null;
    if (imageCache.has(url)) return imageCache.get(url);

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: CONFIG.IMAGE.TIMEOUT,
            validateStatus: (status) => status === 200
        });
        const buffer = Buffer.from(response.data, 'binary');
        imageCache.set(url, buffer);
        return buffer;
    } catch (error) {
        console.error(`Не удалось загрузить изображение: ${url}`);
        return null;
    }
};

// Обработка изображений с ограничением параллелизма
const processImagesWithConcurrency = async (tasks) => {
    const results = [];
    const executing = [];

    for (const task of tasks) {
        const p = task().then(result => {
            executing.splice(executing.indexOf(p), 1);
            return result;
        });

        executing.push(p);
        results.push(p);

        if (executing.length >= CONFIG.IMAGE.CONCURRENCY) {
            await Promise.race(executing);
        }
    }

    return (await Promise.all(results)).filter(Boolean);
};

// Генерация Excel с оптимизациями
const generateExcelForUser = async (userId) => {
    const workbook = new ExcelJS.Workbook();
    workbook.calcProperties.fullCalcOnLoad = false;

    try {
        // Создаем листы один раз
        const sheetBrand = workbook.addWorksheet('Бренд');
        const sheetArticle = workbook.addWorksheet('Артикул');

        // Добавляем заголовки
        sheetBrand.addRow(['Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);
        sheetArticle.addRow(['Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);

        // Заголовки и форматирование
        [sheetBrand, sheetArticle].forEach(sheet => {
            sheet.columns = [
                { key: 'query', width: 30 },    // Запрос
                { key: 'id', width: 15 },       // Артикул или Бренд
                { key: 'city', width: 12 },     // Город
                { key: 'image', width: 15 },    // Картинка (место для изображения)
                { key: 'brand', width: 15 },    // Бренд или Артикул
                { key: 'name', width: 50 },     // Описание товара
                { key: 'position', width: 10 }, // Позиция
                { key: 'time', width: 12 },     // Время запроса
                { key: 'date', width: 12 }      // Дата запроса
            ];

            sheet.getRow(1).eachCell(cell => {
                cell.font = { bold: true };
            });
        });

        // Параллельная загрузка данных
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId })
                .select('query productTables city brand createdAt')
                .lean()
                .populate({
                    path: 'productTables.products',
                    options: { batchSize: CONFIG.DATABASE.BATCH_SIZE }
                })
                .maxTimeMS(CONFIG.DATABASE.TIMEOUT),
            QueryArticleModel.find({ userId })
                .select('query productTables city article createdAt')
                .lean()
                .populate({
                    path: 'productTables.products',
                    options: { batchSize: CONFIG.DATABASE.BATCH_SIZE }
                })
                .maxTimeMS(CONFIG.DATABASE.TIMEOUT)
        ]);

        imageCache.clear();

        // Оптимизированная обработка данных
        const processData = async (queries, sheet, isBrandSheet) => {
            const imageTasks = [];
            const rows = [];

            // Сначала собираем все данные без записи в Excel
            for (const query of queries) {
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
                            isBrandSheet ? product?.brand || query.brand : product?.id,
                            product?.city || query.city,
                            product?.imageUrl || '',
                            isBrandSheet ? product?.id : product?.brand,
                            product?.name,
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                        ];

                        rows.push({ rowData, isPromo: promoPosition.includes('*'), imageUrl: product?.imageUrl });
                    }
                }
            }

            // Затем добавляем все строки сразу
            for (const { rowData, isPromo, imageUrl } of rows) {
                const row = sheet.addRow(rowData);
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

            // Параллельная обработка изображений с ограничением concurrency
            if (imageTasks.length > 0) {
                await processImagesWithConcurrency(imageTasks);
            }
        };

        await Promise.all([
            processData(brandQueries, sheetBrand, true),
            processData(articleQueries, sheetArticle, false)
        ]);

        // Используем потоковый режим для записи
        const buffer = await workbook.xlsx.writeBuffer({
            useSharedStrings: CONFIG.EXCEL.USE_SHARED_STRINGS,
            useStyles: true
        });

        return buffer;
    } finally {
        imageCache.clear();
    }
};

module.exports = { generateExcelForUser };