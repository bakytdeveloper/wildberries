const { getProducts } = require('../api/wildberriesApiUrl');
const { setTimeout } = require('timers/promises');

const cityDestinations = {
    '-2162195': 'г.Москва',
    // '-1275551': 'г.Москва',
    '-1123300': 'г.Санкт-Петербург',
    '123589350': 'г.Дмитров',
    '12358062': 'г.Краснодар',
    '-2133463': 'г.Казань',
    '286': 'г.Бишкек'
};

// Конфигурационные параметры
const CONFIG = {
    MAX_PAGES: 60, // Максимальное количество страниц для парсинга
    MAX_CONCURRENT_PAGES: 4, // Максимальное количество одновременных запросов
    RETRY_DELAY: 1000, // Базовая задержка между повторными попытками (1 секунда)
    MAX_RETRIES: 3, // Максимальное количество повторных попыток
    REQUEST_TIMEOUT: 13000, // Таймаут запроса (13 секунд)
    BATCH_DELAY: 1000 // Задержка между пакетами запросов (1 секунда)
};

function generateImageUrl(id) {
    const t = Math.floor(id / 1e5);
    const ranges = {
        143: "01",
        287: "02",
        431: "03",
        719: "04",
        1007: "05",
        1061: "06",
        1115: "07",
        1169: "08",
        1313: "09",
        1601: "10",
        1655: "11",
        1919: "12",
        2045: "13",
        2189: "14",
        2405: "15",
        2621: "16",
        2837: "17",
        3053: "18",
        3269: "19",
        3485: "20",
        3701: "21",
        3917: "22",
        4133: "23",
        4349: "24",
        4565: "25"
    };
    let r = "26";
    for (const [key, value] of Object.entries(ranges)) {
        if (t <= parseInt(key)) {
            r = value;
            break;
        }
    }
    const vol = `vol${t}`;
    const part = `part${Math.floor(id / 1e3)}`;
    return `https://basket-${r}.wbbasket.ru/${vol}/${part}/${id}/images/big/1.webp` ||
        `https://basket-${r}.wbbasket.ru/${vol}/${part}/${id}/images/c516x688/1.webp`;
}

async function fetchAndParseProducts(query, dest, selectedBrand, queryTime) {
    try {
        const productsMap = new Map();
        let page = 1;
        let hasMoreData = true;
        const baseQuery = selectedBrand === 'S.Point' ? 'Одежда S.Point' : '';
        const searchQuery = query.toLowerCase() === '' ? `${baseQuery} ${selectedBrand.toLowerCase()}` : query.toLowerCase();

        const processPage = async (pageNum, retryCount = 0) => {
            try {
                const data = await getProducts(searchQuery, dest, pageNum);
                const productsRaw = data?.data?.products;

                if (!productsRaw || productsRaw.length === 0) {
                    return { hasMore: false };
                }

                for (const product of productsRaw) {
                    if (product.brand.toLowerCase() === selectedBrand.toLowerCase()) {
                        const productId = product.id;
                        const positionOnPage = productsRaw.findIndex(p => parseInt(p.id) === productId) + 1;
                        const combinedPosition = pageNum > 1
                            ? `${pageNum}${positionOnPage < 10 ? '0' + positionOnPage : positionOnPage}`
                            : String(positionOnPage);

                        if (productsMap.has(productId)) {
                            const existingProduct = productsMap.get(productId);
                            if (parseInt(combinedPosition) < parseInt(existingProduct.combinedPosition)) {
                                productsMap.set(productId, {
                                    ...product,
                                    position: positionOnPage,
                                    combinedPosition: combinedPosition,
                                    page: pageNum,
                                    dest: dest,
                                    city: cityDestinations[dest] || 'Неизвестный город',
                                    query: query,
                                    queryTime: queryTime,
                                    imageUrl: generateImageUrl(product.id),
                                    log: product.log
                                });
                            }
                        } else {
                            productsMap.set(productId, {
                                position: positionOnPage,
                                combinedPosition: combinedPosition,
                                id: product.id,
                                brand: product.brand,
                                name: product.name,
                                page: pageNum,
                                dest: dest,
                                city: cityDestinations[dest] || 'Неизвестный город',
                                query: query,
                                queryTime: queryTime,
                                imageUrl: generateImageUrl(product.id),
                                log: product.log
                            });
                        }
                    }
                }

                return { hasMore: true };
            } catch (error) {
                if (retryCount < CONFIG.MAX_RETRIES) {
                    const delay = CONFIG.RETRY_DELAY * (retryCount + 1);
                    console.warn(`Retry ${retryCount + 1} for page ${pageNum} after ${delay}ms`);
                    await setTimeout(delay);
                    return processPage(pageNum, retryCount + 1);
                }
                console.error(`Failed to process page ${pageNum} after ${CONFIG.MAX_RETRIES} retries`);
                throw error;
            }
        };

        while (hasMoreData && page <= CONFIG.MAX_PAGES) {
            const promises = [];
            const pagesToProcess = Math.min(
                CONFIG.MAX_CONCURRENT_PAGES,
                CONFIG.MAX_PAGES - page + 1
            );

            for (let i = 0; i < pagesToProcess; i++) {
                promises.push(processPage(page + i));
            }

            const results = await Promise.all(promises);
            for (const result of results) {
                if (!result.hasMore) {
                    hasMoreData = false;
                }
            }

            page += pagesToProcess;

            if (hasMoreData && page <= CONFIG.MAX_PAGES) {
                await setTimeout(CONFIG.BATCH_DELAY);
            }
        }

        // Сортируем товары по combinedPosition (от меньшего к большему)
        const sortedProducts = Array.from(productsMap.values()).sort((a, b) => {
            return parseInt(a.combinedPosition) - parseInt(b.combinedPosition);
        });

        return sortedProducts;
    } catch (error) {
        console.error(`Error parsing products for query "${query}", brand "${selectedBrand}":`, error);
        throw error;
    }
}

async function fetchAndParseProductsByArticle(query, dest, article, queryTime) {
    try {
        let foundProduct = null;
        let page = 1;
        let hasMoreData = true;
        const searchQuery = query.toLowerCase();

        const processPage = async (pageNum, retryCount = 0) => {
            try {
                const data = await getProducts(searchQuery, dest, pageNum);
                const productsRaw = data?.data?.products;

                if (!productsRaw || productsRaw.length === 0) {
                    return { hasMore: false };
                }

                const product = productsRaw.find(p => String(p.id) == String(article));
                if (product) {
                    const positionOnPage = productsRaw.findIndex(p => String(p.id) === String(article)) + 1;
                    const combinedPosition = pageNum > 1
                        ? `${pageNum}${positionOnPage < 10 ? '0' + positionOnPage : positionOnPage}`
                        : String(positionOnPage);

                    foundProduct = {
                        position: positionOnPage,
                        combinedPosition: combinedPosition,
                        id: product.id,
                        brand: product.brand,
                        name: product.name,
                        page: pageNum,
                        dest: dest,
                        city: cityDestinations[dest] || 'Неизвестный город',
                        query: query,
                        queryTime: queryTime,
                        imageUrl: generateImageUrl(product.id),
                        log: product.log
                    };
                    return { hasMore: false };
                }

                return { hasMore: true };
            } catch (error) {
                if (retryCount < CONFIG.MAX_RETRIES) {
                    const delay = CONFIG.RETRY_DELAY * (retryCount + 1);
                    console.warn(`Retry ${retryCount + 1} for article ${article} page ${pageNum} after ${delay}ms`);
                    await setTimeout(delay);
                    return processPage(pageNum, retryCount + 1);
                }
                console.error(`Failed to process page ${pageNum} for article ${article} after ${CONFIG.MAX_RETRIES} retries`);
                throw error;
            }
        };

        while (hasMoreData && page <= CONFIG.MAX_PAGES && !foundProduct) {
            const promises = [];
            const pagesToProcess = Math.min(
                CONFIG.MAX_CONCURRENT_PAGES,
                CONFIG.MAX_PAGES - page + 1
            );

            for (let i = 0; i < pagesToProcess; i++) {
                promises.push(processPage(page + i));
            }

            const results = await Promise.all(promises);
            for (const result of results) {
                if (!result.hasMore) {
                    hasMoreData = false;
                }
            }

            page += pagesToProcess;

            if (hasMoreData && page <= CONFIG.MAX_PAGES && !foundProduct) {
                await setTimeout(CONFIG.BATCH_DELAY);
            }
        }

        return foundProduct ? [foundProduct] : [];
    } catch (error) {
        console.error(`Error parsing products for article "${article}":`, error);
        throw error;
    }
}

module.exports = {
    fetchAndParseProducts,
    fetchAndParseProductsByArticle,
    CONFIG
};