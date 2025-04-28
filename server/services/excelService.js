const ExcelJS = require('exceljs');
const axios = require('axios');
const { QueryArticleModel } = require("../models/queryArticleModel");
const { QueryModel } = require("../models/queryModel");
const imageCache = new Map();

// Конфигурация
const CONFIG = {
    IMAGE: { TIMEOUT: 15000, RETRIES: 3, RETRY_DELAY: 1000, BATCH_SIZE: 10, SIZE: { width: 30, height: 30 } },
    DATABASE: { TIMEOUT: 30000 },
    STREAM: { CHUNK_SIZE: 100 }
};

// Улучшенная загрузка изображений
const downloadImage = async (url) => {
    if (!url) return null;
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
    const results = await Promise.all(tasks.map(task => task()));
    return results.filter(r => r).map(r => r);
};

// Создание строки данных
const createRowData = (product, query, isBrandSheet) => {
    const position = product?.page > 1 ? `${product.page}${String(product.position).padStart(2, '0')}` : String(product?.position || '');
    const promoPosition = product?.log?.promoPosition ? `${product.log.promoPosition}*` : position;
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
        const sheetBrand = workbook.addWorksheet('Бренд');
        const sheetArticle = workbook.addWorksheet('Артикул');

        sheetBrand.addRow(['Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);
        sheetArticle.addRow(['Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса']);

        const [brandQueries, articleQueries] = await Promise.all([
            QueryModel.find({ userId })
                .select('query productTables city brand createdAt')
                .lean()
                .populate({ path: 'productTables.products', options: { batchSize: 100 } })
                .maxTimeMS(CONFIG.DATABASE.TIMEOUT),
            QueryArticleModel.find({ userId })
                .select('query productTables city article createdAt')
                .lean()
                .populate({ path: 'productTables.products', options: { batchSize: 100 } })
                .maxTimeMS(CONFIG.DATABASE.TIMEOUT)
        ]);

        imageCache.clear();

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
                                try {
                                    const imageBuffer = await downloadImage(imageUrl);
                                    if (imageBuffer) {
                                        const extension = imageUrl.split('.').pop() === 'png' ? 'png' : 'jpeg';
                                        const imageId = workbook.addImage({ buffer: imageBuffer, extension });
                                        sheet.addImage(imageId, { tl: { col: 3, row: row.number - 1, offset: 5 }, ext: CONFIG.IMAGE.SIZE });
                                        sheet.getRow(row.number).height = CONFIG.IMAGE.SIZE.height;
                                    }
                                } catch (err) {
                                    console.error('Ошибка обработки изображения:', err);
                                }
                            });
                            if (imageTasks.length >= CONFIG.IMAGE.BATCH_SIZE) {
                                await processImagesBatch(imageTasks.splice(0, CONFIG.IMAGE.BATCH_SIZE));
                                process.nextTick(() => {});
                            }
                        }
                    }
                }
            }
            if (imageTasks.length > 0) {
                await processImagesBatch(imageTasks);
            }
        };

        await Promise.all([
            processData(brandQueries, sheetBrand, true),
            processData(articleQueries, sheetArticle, false)
        ]);

        const buffer = await workbook.xlsx.writeBuffer();
        imageCache.clear();
        return buffer;
    } catch (error) {
        imageCache.clear();
        console.error('Ошибка создания Excel:', error);
        throw error;
    } finally {
        console.log('Очистка кэша в finally блоке.');
        imageCache.clear();
        console.log('После очистки кэша в finally, размер imageCache:', imageCache.size);
    }
};

module.exports = { generateExcelForUser };
