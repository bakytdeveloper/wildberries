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

const processImagesWithConcurrency = async (tasks) => {
    const results = [];
    const executing = [];

    for (const task of tasks) {
        const p = task().then(result => {
            executing.splice(executing.indexOf(p), 1);
            return result;
        }).catch(err => {
            console.error('Ошибка обработки изображения:', err);
            return null;
        });

        executing.push(p);
        results.push(p);

        if (executing.length >= CONFIG.IMAGE.CONCURRENCY) {
            await Promise.race(executing);
        }
    }

    return (await Promise.all(results)).filter(Boolean);
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
    const today = new Date();
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

        // Загрузка данных с пагинацией
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId }).lean().populate('productTables.products'),
            QueryArticleModel.find({ userId }).lean().populate('productTables.products')
        ]);

        // Фильтрация данных по временным интервалам
        const filteredBrandQueries = filterDataByTimeIntervals(brandQueries);
        const filteredArticleQueries = filterDataByTimeIntervals(articleQueries);

        imageCache.clear();

        // Обработка данных с батчингом и паузами для event loop
        const processData = async (queries, sheet, isBrandSheet) => {
            let rowCount = 0;
            const imageTasks = [];

            for (const query of queries) {
                for (const table of query.productTables) {
                    for (const product of table.products) {
                        rowCount++;

                        // Пауза для event loop каждые BATCH_SIZE строк
                        if (rowCount % CONFIG.DATABASE.BATCH_SIZE === 0) {
                            await new Promise(resolve => setImmediate(resolve));
                            await processImagesWithConcurrency(imageTasks.splice(0, imageTasks.length));
                        }

                        // Проверка на максимальное количество строк
                        if (rowCount >= CONFIG.MAX_ROWS_PER_SHEET) {
                            console.warn(`Достигнут лимит строк (${CONFIG.MAX_ROWS_PER_SHEET}) для листа ${sheet.name}`);
                            break;
                        }

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
                    }
                }
            }

            // Обработать оставшиеся изображения
            if (imageTasks.length > 0) {
                await processImagesWithConcurrency(imageTasks);
            }
        };

        await Promise.all([
            processData(filteredBrandQueries, sheetBrand, true),
            processData(filteredArticleQueries, sheetArticle, false)
        ]);

        // Сохраняем файл
        await workbook.xlsx.writeFile(tempFilePath);
        return tempFilePath;

    } catch (error) {
        // Удаляем временный файл при ошибке
        if (fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (err) {
                console.error('Ошибка при удалении временного файла:', err);
            }
        }
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