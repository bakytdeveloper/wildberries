const ExcelJS = require('exceljs');
const axios = require('axios');
const { QueryArticleModel } = require("../models/queryArticleModel");
const { QueryModel } = require("../models/queryModel");
const imageCache = new Map();

// Усиленная конфигурация
const CONFIG = {
    IMAGE: {
        TIMEOUT: 5000,
        RETRIES: 2,
        RETRY_DELAY: 300,
        BATCH_SIZE: 10,
        SIZE: { width: 30, height: 30 },
        CONCURRENCY: 10
    },
    DATABASE: {
        TIMEOUT: 30000,
        BATCH_SIZE: 100
    },
    EXCEL: {
        STREAMING: false,
        USE_SHARED_STRINGS: false
    }
};

// Оптимизированная загрузка изображений
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

const generateExcelForUser = async (userId, res) => {
    const workbook = new ExcelJS.Workbook();
    workbook.calcProperties.fullCalcOnLoad = false;

    // Функция для периодического "пинга" соединения
    const pingConnection = () => {
        try {
            if (res && !res.headersSent) {
                res.write(' ');
            }
        } catch (e) {
            console.log('Connection closed during ping');
        }
    };

    let pingInterval;

    try {
        // Создаем листы
        const sheetBrand = workbook.addWorksheet('Бренд');
        const sheetArticle = workbook.addWorksheet('Артикул');

        // Добавляем заголовки
        sheetBrand.addRow(['Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);
        sheetArticle.addRow(['Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);

        // Настройка колонок
        [sheetBrand, sheetArticle].forEach(sheet => {
            sheet.columns = [
                { key: 'query', width: 30 },
                { key: 'id', width: 15 },
                { key: 'city', width: 12 },
                { key: 'image', width: 15 },
                { key: 'brand', width: 15 },
                { key: 'name', width: 50 },
                { key: 'position', width: 10 },
                { key: 'time', width: 12 },
                { key: 'date', width: 12 }
            ];

            sheet.getRow(1).eachCell(cell => {
                cell.font = { bold: true };
            });
        });

        // Запускаем пинг соединения каждые 30 секунд
        if (res) {
            pingInterval = setInterval(pingConnection, 30000);
        }

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

        // Обработка данных
        const processData = async (queries, sheet, isBrandSheet) => {
            const imageTasks = [];
            const rows = [];

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

            if (imageTasks.length > 0) {
                await processImagesWithConcurrency(imageTasks);
            }
        };

        await Promise.all([
            processData(brandQueries, sheetBrand, true),
            processData(articleQueries, sheetArticle, false)
        ]);

        const buffer = await workbook.xlsx.writeBuffer({
            useSharedStrings: CONFIG.EXCEL.USE_SHARED_STRINGS,
            useStyles: true
        });

        return buffer;
    } finally {
        if (pingInterval) clearInterval(pingInterval);
        imageCache.clear();
    }
};

module.exports = { generateExcelForUser };