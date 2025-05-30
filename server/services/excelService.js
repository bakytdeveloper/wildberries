const ExcelJS = require('exceljs');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { QueryArticleModel } = require("../models/queryArticleModel");
const { QueryModel } = require("../models/queryModel");
const imageCache = new Map();
const retry = require('async-retry');

// Конфигурация
const CONFIG = {
    IMAGE: {
        TIMEOUT: 10000, // Увеличили таймаут
        RETRIES: 3, // Увеличили количество попыток
        SIZE: { width: 30, height: 30 },
        CONCURRENCY: 5, // Уменьшили параллелизм для уменьшения нагрузки
        MAX_CACHE: 100,
        DELAY_BETWEEN_RETRIES: 1000 // Задержка между попытками
    },
    DATABASE: {
        TIMEOUT: 30000,
        BATCH_SIZE: 500
    },
    TEMP_DIR: './temp_exports',
    CLEANUP_INTERVAL: 3600000, // 1 час
    MAX_ROWS_PER_SHEET: 1000000,
    IMAGE_DOWNLOAD_TIMEOUT: 15000 // Общий таймаут для загрузки изображения
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
            if (file.startsWith('PosWB_')) {
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

    try {
        return await retry(
            async (bail, attempt) => {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), CONFIG.IMAGE.TIMEOUT);

                    const response = await axios.get(url, {
                        responseType: 'arraybuffer',
                        signal: controller.signal,
                        timeout: CONFIG.IMAGE.TIMEOUT
                    });

                    clearTimeout(timeout);
                    const buffer = Buffer.from(response.data, 'binary');
                    imageCache.set(url, buffer);
                    return buffer;
                } catch (error) {
                    if (error.code === 'ECONNABORTED' || error.response?.status >= 400) {
                        throw error; // Пробуем снова
                    } else {
                        bail(error); // Неповторимая ошибка
                        return null;
                    }
                }
            },
            {
                retries: CONFIG.IMAGE.RETRIES,
                minTimeout: CONFIG.IMAGE.DELAY_BETWEEN_RETRIES,
                maxTimeout: CONFIG.IMAGE.DELAY_BETWEEN_RETRIES * 2,
                onRetry: (error, attempt) => {
                    console.log(`Попытка ${attempt} загрузки изображения ${url}: ${error.message}`);
                }
            }
        );
    } catch (error) {
        console.error(`Окончательная ошибка загрузки изображения ${url}: ${error.message}`);
        return null;
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
        .replace(/T/, '_')
        .replace(/\..+/, '')
        .replace(/:/g, '-');

    const tempXlsxPath = path.join(CONFIG.TEMP_DIR, `PosWB_${userId}_${formattedDateTime}.xlsx`);

    const workbook = new ExcelJS.Workbook();
    workbook.calcProperties.fullCalcOnLoad = false;
    workbook.calcProperties.calcMode = 'manual';

    try {
        // Создаем листы
        const sheetBrand = workbook.addWorksheet('Бренд', {
            views: [{ showGridLines: false }],
            pageSetup: { fitToPage: true }
        });
        const sheetArticle = workbook.addWorksheet('Артикул', {
            views: [{ showGridLines: false }],
            pageSetup: { fitToPage: true }
        });

        // Заголовки
        const brandHeaders = ['Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата (м/д/г)'];
        const articleHeaders = ['Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата (м/д/г)'];

        // Добавляем заголовки и настраиваем стили
        [sheetBrand, sheetArticle].forEach((sheet, index) => {
            const headers = index === 0 ? brandHeaders : articleHeaders;
            const headerRow = sheet.addRow(headers);

            // Стили для заголовков
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF0070C0' } // Темно-синий цвет фона
            };

            // Добавляем вертикальные разделители между заголовками
            headerRow.eachCell((cell, colNumber) => {
                if (colNumber < headers.length) {
                    cell.border = {
                        right: { style: 'thin', color: { argb: 'FFCCCCCC' } } // Темно-синяя линия
                    };
                }
            });

            // Фиксируем заголовки
            sheet.views = [{ state: 'frozen', ySplit: 1 }];

            // Настраиваем ширину колонок
            sheet.columns = headers.map((header, i) => ({
                header,
                key: `col${i+1}`,
                width: [30, 15, 12, 15, 15, 50, 10, 12, 12][i]
            }));
        });

        // Загрузка данных
        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId }).lean().populate('productTables.products'),
            QueryArticleModel.find({ userId }).lean().populate('productTables.products')
        ]);

        // Фильтрация данных
        const filteredBrandQueries = filterDataByTimeIntervals(brandQueries);
        const filteredArticleQueries = filterDataByTimeIntervals(articleQueries);

        imageCache.clear();

        // Улучшенная функция обработки изображений
        const processImage = async (imageUrl) => {
            if (!imageUrl) return null;

            try {
                // Проверяем кэш
                if (imageCache.has(imageUrl)) {
                    return imageCache.get(imageUrl);
                }

                // Загружаем изображение с таймаутом
                const imageBuffer = await Promise.race([
                    downloadImage(imageUrl),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout exceeded')), CONFIG.IMAGE_DOWNLOAD_TIMEOUT)
                    )
                ]);

                if (!imageBuffer) return null;

                // Оптимизируем изображение
                const sharp = require('sharp');
                const optimizedImage = await sharp(imageBuffer)
                    .resize(150, 150, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({ quality: 80 })
                    .toBuffer();

                // Кэшируем
                if (imageCache.size < CONFIG.IMAGE.MAX_CACHE) {
                    imageCache.set(imageUrl, optimizedImage);
                }

                return optimizedImage;
            } catch (error) {
                console.error(`Ошибка обработки изображения ${imageUrl}:`, error.message);
                return null;
            }
        };

        // Функция для добавления изображения в ячейку
        const addImageToCell = async (sheet, rowNumber, imageUrl) => {
            try {
                const imageBuffer = await processImage(imageUrl);
                if (!imageBuffer) return;

                const extension = imageUrl.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
                const imageId = workbook.addImage({
                    buffer: imageBuffer,
                    extension: extension
                });

                sheet.addImage(imageId, {
                    tl: { col: 3, row: rowNumber - 1, offset: 5 },
                    ext: { width: 30, height: 30 },
                    editAs: 'oneCell' // Привязываем изображение к одной ячейке
                });
            } catch (error) {
                console.error('Ошибка вставки изображения:', error);
            }
        };

        // Общая функция для обработки данных
        const processData = async (queries, sheet, isBrandSheet) => {
            let previousQuery = null;
            const imageTasks = [];
            const failedImages = new Set();

            for (const query of queries) {
                // Добавляем пустую строку между разными запросами
                if (previousQuery !== null && query.query !== previousQuery) {
                    sheet.addRow(Array(9).fill(''));
                }
                previousQuery = query.query;

                for (const table of query.productTables) {
                    for (const product of table.products) {
                        const position = product?.page > 1
                            ? `${product.page}${String(product.position).padStart(2, '0')}`
                            : String(product?.position || '');

                        const promoPosition = product?.log?.promoPosition
                            ? `${product.log.promoPosition}*`
                            : position;

                        // Формируем данные строки
                        const rowData = isBrandSheet ? [
                            product?.query || query.query,
                            product?.brand || query.brand,
                            product?.city || query.city,
                            '', // Место для изображения
                            product?.id,
                            product?.name,
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                        ] : [
                            product?.query || query.query,
                            product?.id,
                            product?.city || query.city,
                            '', // Место для изображения
                            product?.brand,
                            product?.name,
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString()
                        ];

                        // Добавляем строку
                        const row = sheet.addRow(rowData);

                        // Форматирование для промо-позиций
                        if (promoPosition.includes('*')) {
                            row.getCell(7).font = { bold: true, color: { argb: 'FFFF0000' } };
                        }

                        // Добавляем задачу на обработку изображения, если оно не в списке неудачных
                        if (product?.imageUrl && !failedImages.has(product.imageUrl)) {
                            const task = addImageToCell(sheet, row.number, product.imageUrl)
                                .catch(() => failedImages.add(product.imageUrl));

                            imageTasks.push(task);

                            // Ограничиваем количество параллельных задач
                            if (imageTasks.length >= CONFIG.IMAGE.CONCURRENCY) {
                                await Promise.all(imageTasks.splice(0, CONFIG.IMAGE.CONCURRENCY));
                            }
                        }
                    }
                }
            }

            // Ожидаем завершения всех задач с изображениями
            await Promise.all(imageTasks);
        };

        // Обработка данных для обоих листов
        await Promise.all([
            processData(filteredBrandQueries, sheetBrand, true),
            processData(filteredArticleQueries, sheetArticle, false)
        ]);

        // Оптимизация перед сохранением
        workbook.worksheets.forEach(sheet => {
            sheet.autoFilter = null;
            // Автоподбор высоты строк для лучшего отображения
            sheet.eachRow(row => {
                row.height = 25; // Фиксированная высота строки
            });
        });

        // Сохранение файла
        await workbook.xlsx.writeFile(tempXlsxPath, {
            useSharedStrings: true,
            useStyles: true
        });

        return tempXlsxPath;
    } catch (error) {
        console.error('Ошибка при генерации Excel:', error);
        if (fs.existsSync(tempXlsxPath)) {
            fs.unlinkSync(tempXlsxPath);
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