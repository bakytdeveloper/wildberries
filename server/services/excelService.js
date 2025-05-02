const ExcelJS = require('exceljs');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { QueryArticleModel } = require("../models/queryArticleModel");
const { QueryModel } = require("../models/queryModel");
const imageCache = new Map();

// Конфигурация
const CONFIG = {
    IMAGE: {
        TIMEOUT: 5000,
        RETRIES: 2,
        SIZE: { width: 30, height: 30 },
        CONCURRENCY: 10,
        MAX_CACHE: 50
    },
    DATABASE: {
        TIMEOUT: 30000,
        BATCH_SIZE: 100
    },
    TEMP_DIR: './temp_exports',
    CLEANUP_INTERVAL: 3600000 // 1 час
};

// Создаем директорию для временных файлов
if (!fs.existsSync(CONFIG.TEMP_DIR)) {
    fs.mkdirSync(CONFIG.TEMP_DIR, { recursive: true });
}

// Очистка старых файлов
setInterval(() => {
    fs.readdir(CONFIG.TEMP_DIR, (err, files) => {
        if (err) return;

        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(CONFIG.TEMP_DIR, file);
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > CONFIG.CLEANUP_INTERVAL) {
                fs.unlinkSync(filePath);
            }
        });
    });
}, CONFIG.CLEANUP_INTERVAL);

const downloadImage = async (url) => {
    if (!url) return null;

    // Очистка кэша
    if (imageCache.size >= CONFIG.IMAGE.MAX_CACHE) {
        const oldestKey = imageCache.keys().next().value;
        imageCache.delete(oldestKey);
    }

    if (imageCache.has(url)) return imageCache.get(url);

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: CONFIG.IMAGE.TIMEOUT
        });
        const buffer = Buffer.from(response.data, 'binary');
        imageCache.set(url, buffer);
        return buffer;
    } catch (error) {
        console.error(`Ошибка загрузки изображения: ${url}`);
        return null;
    }
};

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

const generateExcelForUser = async (userId) => {
    const tempFilePath = path.join(CONFIG.TEMP_DIR, `export_${userId}_${Date.now()}.xlsx`);
    const workbook = new ExcelJS.Workbook();
    workbook.calcProperties.fullCalcOnLoad = false;

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

        // Загрузка данных
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId }).lean().populate('productTables.products'),
            QueryArticleModel.find({ userId }).lean().populate('productTables.products')
        ]);

        imageCache.clear();

        // Обработка данных с батчингом
        const processData = async (queries, sheet, isBrandSheet) => {
            const BATCH_SIZE = 100;
            let batch = [];
            const imageTasks = [];

            for (const query of queries) {
                for (const table of query.productTables) {
                    for (const product of table.products) {
                        const position = product?.page > 1
                            ? `${product.page}${String(product.position).padStart(2, '0')}`
                            : String(product?.position || '');

                        const promoPosition = product?.log?.promoPosition
                            ? `${product.log.promoPosition}*`
                            : position;

                        const row = sheet.addRow([
                            product?.query || query.query,
                            isBrandSheet ? product?.brand || query.brand : product?.id,
                            product?.city || query.city,
                            product?.imageUrl || '',
                            isBrandSheet ? product?.id : product?.brand,
                            product?.name,
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                        ]);

                        if (promoPosition.includes('*')) {
                            row.getCell(7).font = { bold: true, color: { argb: 'FFFF0000' } };
                        }

                        if (product?.imageUrl) {
                            imageTasks.push(async () => {
                                const imageBuffer = await downloadImage(product.imageUrl);
                                if (imageBuffer) {
                                    const extension = product.imageUrl.split('.').pop() === 'png' ? 'png' : 'jpeg';
                                    const imageId = workbook.addImage({
                                        buffer: imageBuffer,
                                        extension: extension
                                    });

                                    sheet.addImage(imageId, {
                                        tl: { col: 3, row: row.number - 1, offset: 5 },
                                        ext: CONFIG.IMAGE.SIZE
                                    });

                                    sheet.getRow(row.number).height = CONFIG.IMAGE.SIZE.height;
                                }
                            });
                        }

                        batch.push(row);
                        if (batch.length >= BATCH_SIZE) {
                            await processImagesWithConcurrency(imageTasks.splice(0, imageTasks.length));
                            batch = [];
                        }
                    }
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

        // Сохраняем во временный файл
        await workbook.xlsx.writeFile(tempFilePath);
        return tempFilePath;

    } catch (error) {
        // Удаляем временный файл при ошибке
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        throw error;
    } finally {
        imageCache.clear();
    }
};

module.exports = {
    generateExcelForUser,
    cleanupTempFiles: () => {
        fs.readdirSync(CONFIG.TEMP_DIR).forEach(file => {
            fs.unlinkSync(path.join(CONFIG.TEMP_DIR, file));
        });
    }
};