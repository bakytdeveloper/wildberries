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
        BATCH_SIZE: 500
    },
    TEMP_DIR: './temp_exports',
    CLEANUP_INTERVAL: 3600000, // 1 час
    MAX_ROWS_PER_SHEET: 1000000
};

// Создаем директорию для временных файлов
if (!fs.existsSync(CONFIG.TEMP_DIR)) {
    fs.mkdirSync(CONFIG.TEMP_DIR, { recursive: true });
}

// Очистка старых файлов
setInterval(() => {
    try {
        const files = fs.readdirSync(CONFIG.TEMP_DIR);
        const now = Date.now();
        files.forEach(file => {
            if (file.startsWith('export_')) {
                const filePath = path.join(CONFIG.TEMP_DIR, file);
                try {
                    const stat = fs.statSync(filePath);
                    if (now - stat.mtimeMs > CONFIG.CLEANUP_INTERVAL) {
                        fs.unlinkSync(filePath);
                        console.log(`Удален временный файл: ${file}`);
                    }
                } catch (err) {
                    console.error(`Ошибка при удалении файла ${file}:`, err);
                }
            }
        });
    } catch (err) {
        console.error('Ошибка при очистке временных файлов:', err);
    }
}, CONFIG.CLEANUP_INTERVAL);

const downloadImage = async (url) => {
    if (!url) return null;

    // Очистка кэша
    if (imageCache.size >= CONFIG.IMAGE.MAX_CACHE) {
        const oldestKey = imageCache.keys().next().value;
        imageCache.delete(oldestKey);
    }

    if (imageCache.has(url)) return imageCache.get(url);

    for (let attempt = 1; attempt <= CONFIG.IMAGE.RETRIES; attempt++) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: CONFIG.IMAGE.TIMEOUT
            });
            const buffer = Buffer.from(response.data, 'binary');
            imageCache.set(url, buffer);
            return buffer;
        } catch (error) {
            if (attempt === CONFIG.IMAGE.RETRIES) {
                console.error(`Ошибка загрузки изображения после ${CONFIG.IMAGE.RETRIES} попыток: ${url}`);
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
};

// Функция для проверки, находится ли дата в текущем дне
const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
};

// Функция для получения ближайшего временного интервала (каждые 4 часа)
const getNearestInterval = (date) => {
    const intervals = [0, 4, 8, 12, 16, 20]; // Часы для интервалов
    const hour = date.getHours();

    // Находим ближайший меньший интервал
    let nearestInterval = intervals[0];
    for (const interval of intervals) {
        if (interval <= hour) {
            nearestInterval = interval;
        } else {
            break;
        }
    }

    // Создаем дату с ближайшим интервалом
    const intervalDate = new Date(date);
    intervalDate.setHours(nearestInterval, 0, 0, 0);

    return intervalDate;
};

// Функция для фильтрации данных по временным интервалам
const filterDataByTimeIntervals = (queries) => {
    const filteredQueries = [];

    for (const query of queries) {
        const queryDate = new Date(query.createdAt);

        // Если данные сегодняшние - добавляем все
        if (isToday(queryDate)) {
            filteredQueries.push(query);
            continue;
        }

        // Для данных не сегодняшних - проверяем временной интервал
        const nearestInterval = getNearestInterval(queryDate);
        const queryTime = queryDate.getTime();
        const intervalTime = nearestInterval.getTime();

        // Проверяем, что запрос находится в пределах 4 часов от интервала
        if (queryTime >= intervalTime && queryTime < intervalTime + 4 * 60 * 60 * 1000) {
            // Проверяем, нет ли уже запроса для этого интервала
            const existingQueryIndex = filteredQueries.findIndex(q => {
                const qDate = new Date(q.createdAt);
                const qInterval = getNearestInterval(qDate);
                return qInterval.getTime() === intervalTime;
            });

            // Если нет запроса для этого интервала или текущий запрос ближе к началу интервала
            if (existingQueryIndex === -1 ||
                new Date(filteredQueries[existingQueryIndex].createdAt).getTime() > queryTime) {
                if (existingQueryIndex !== -1) {
                    filteredQueries.splice(existingQueryIndex, 1);
                }
                filteredQueries.push(query);
            }
        }
    }

    return filteredQueries;
};

const generateExcelForUser = async (userId) => {
    const formattedDateTime = new Date().toISOString()
        .replace(/T/, '_')  // заменяем T на подчеркивание
        .replace(/\..+/, '') // удаляем миллисекунды
        .replace(/:/g, '-'); // заменяем двоеточия на дефисы

    const tempXlsxPath = path.join(CONFIG.TEMP_DIR, `export_${userId}_${formattedDateTime}.xlsx`);

    const workbook = new ExcelJS.Workbook();
    workbook.calcProperties.fullCalcOnLoad = false;
    workbook.calcProperties.calcMode = 'manual';

    try {
        // Создаем листы
        const sheetBrand = workbook.addWorksheet('Бренд', { views: [{ showGridLines: false }] });
        const sheetArticle = workbook.addWorksheet('Артикул', { views: [{ showGridLines: false }] });

        // Разные заголовки для каждого листа
        const brandHeaders = ['Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата (м/д/г)'];
        const articleHeaders = ['Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата (м/д/г)'];

        // Добавляем заголовки
        sheetBrand.addRow(brandHeaders);
        sheetArticle.addRow(articleHeaders);

        // Настраиваем колонки для каждого листа отдельно
        sheetBrand.columns = brandHeaders.map((header, i) => ({
            header,
            key: `col${i+1}`, // Используем простые ключи вместо преобразованных имен
            width: [30, 15, 12, 15, 15, 50, 10, 12, 12][i]
        }));

        sheetArticle.columns = articleHeaders.map((header, i) => ({
            header,
            key: `col${i+1}`, // Используем простые ключи вместо преобразованных имен
            width: [30, 15, 12, 15, 15, 50, 10, 12, 12][i]
        }));

        // Стили для заголовков
        sheetBrand.getRow(1).font = { bold: true };
        sheetArticle.getRow(1).font = { bold: true };

        // Загрузка данных с пагинацией
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId }).lean().populate('productTables.products'),
            QueryArticleModel.find({ userId }).lean().populate('productTables.products')
        ]);

        // Фильтрация данных по временным интервалам
        const filteredBrandQueries = filterDataByTimeIntervals(brandQueries);
        const filteredArticleQueries = filterDataByTimeIntervals(articleQueries);

        imageCache.clear();

        // Функция для обработки изображений
        const processImage = async (imageUrl) => {
            try {
                const buffer = await downloadImage(imageUrl);
                if (!buffer) return null;

                const sharp = require('sharp');
                return await sharp(buffer)
                    .resize(150, 150, { fit: 'inside' })
                    .jpeg({ quality: 70 })
                    .png({ compressionLevel: 6 })
                    .toBuffer();
            } catch (err) {
                console.error('Ошибка обработки изображения:', err);
                return null;
            }
        };

        // Обработка данных для листа "Бренд"
        const processBrandData = async (queries, sheet) => {
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
                            product?.brand || query.brand,
                            product?.city || query.city,
                            product?.imageUrl || '',
                            product?.id,
                            product?.name,
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                        ]);

                        // Позиция находится в 7-м столбце (индекс 6)
                        if (promoPosition.includes('*')) {
                            row.getCell(7).font = { bold: true, color: { argb: 'FFFF0000' } };
                        }

                        if (product?.imageUrl) {
                            imageTasks.push((async () => {
                                const optimizedImage = await processImage(product.imageUrl);
                                if (optimizedImage) {
                                    const extension = product.imageUrl.split('.').pop() === 'png' ? 'png' : 'jpeg';
                                    const imageId = workbook.addImage({
                                        buffer: optimizedImage,
                                        extension: extension
                                    });

                                    // Картинка добавляется в 4-й столбец (индекс 3)
                                    sheet.addImage(imageId, {
                                        tl: { col: 3, row: row.number - 1, offset: 5 },
                                        ext: { width: 30, height: 30 }
                                    });
                                }
                            })());
                        }

                        if (imageTasks.length >= CONFIG.IMAGE.CONCURRENCY) {
                            await Promise.all(imageTasks.splice(0, CONFIG.IMAGE.CONCURRENCY));
                        }
                    }
                }
            }

            await Promise.all(imageTasks);
        };

        // Обработка данных для листа "Артикул"
        const processArticleData = async (queries, sheet) => {
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
                            product?.id,
                            product?.city || query.city,
                            product?.imageUrl || '',
                            product?.brand,
                            product?.name,
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                        ]);

                        // Позиция находится в 7-м столбце (индекс 6)
                        if (promoPosition.includes('*')) {
                            row.getCell(7).font = { bold: true, color: { argb: 'FFFF0000' } };
                        }

                        if (product?.imageUrl) {
                            imageTasks.push((async () => {
                                const optimizedImage = await processImage(product.imageUrl);
                                if (optimizedImage) {
                                    const extension = product.imageUrl.split('.').pop() === 'png' ? 'png' : 'jpeg';
                                    const imageId = workbook.addImage({
                                        buffer: optimizedImage,
                                        extension: extension
                                    });

                                    // Картинка добавляется в 4-й столбец (индекс 3)
                                    sheet.addImage(imageId, {
                                        tl: { col: 3, row: row.number - 1, offset: 5 },
                                        ext: { width: 30, height: 30 }
                                    });
                                }
                            })());
                        }

                        if (imageTasks.length >= CONFIG.IMAGE.CONCURRENCY) {
                            await Promise.all(imageTasks.splice(0, CONFIG.IMAGE.CONCURRENCY));
                        }
                    }
                }
            }

            await Promise.all(imageTasks);
        };

        await Promise.all([
            processBrandData(filteredBrandQueries, sheetBrand),
            processArticleData(filteredArticleQueries, sheetArticle)
        ]);

        // Оптимизация: отключаем автофильтры перед сохранением
        workbook.worksheets.forEach(sheet => {
            sheet.autoFilter = null;
        });

        // Сохраняем с оптимизацией
        await workbook.xlsx.writeFile(tempXlsxPath, {
            useSharedStrings: true
        });

        return tempXlsxPath;
    } catch (error) {
        [tempXlsxPath].forEach(filePath => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        throw error;
    } finally {
        imageCache.clear();
    }
};

module.exports = {
    generateExcelForUser,
    cleanupTempFiles: () => {
        try {
            const files = fs.readdirSync(CONFIG.TEMP_DIR);
            files.forEach(file => {
                try {
                    fs.unlinkSync(path.join(CONFIG.TEMP_DIR, file));
                    console.log(`Удален временный файл: ${file}`);
                } catch (err) {
                    console.error(`Ошибка при удалении файла ${file}:`, err);
                }
            });
        } catch (err) {
            console.error('Ошибка при очистке временных файлов:', err);
        }
    }
};