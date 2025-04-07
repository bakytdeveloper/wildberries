const { getProducts } = require('../api/wildberriesApiUrl');
const { setTimeout } = require('timers/promises');

const cityDestinations = {
    '-1275551': 'г.Москва',
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
    REQUEST_TIMEOUT: 10000, // Таймаут запроса (10 секунд)
    BATCH_DELAY: 500 // Задержка между пакетами запросов (0.5 секунды)
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
        const products = [];
        let page = 1;
        let hasMoreData = true;
        const baseQuery = selectedBrand === 'S.Point' ? 'Одежда S.Point' : '';
        const searchQuery = query.toLowerCase() === '' ? `${baseQuery} ${selectedBrand.toLowerCase()}` : query.toLowerCase();

        const processPage = async (pageNum, retryCount = 0) => {
            try {
                const data = await getProducts(searchQuery, dest, pageNum);
                const productsRaw = data?.data?.products;

                if (!productsRaw || productsRaw.length === 0) {
                    return { products: [], hasMore: false };
                }

                const filteredProducts = productsRaw
                    .filter(product => product.brand.toLowerCase() === selectedBrand.toLowerCase())
                    .map(product => ({
                        position: productsRaw.findIndex(p => parseInt(p.id) === product.id) + 1,
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
                    }));

                return { products: filteredProducts, hasMore: true };
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

            // Создаем пакет запросов
            for (let i = 0; i < pagesToProcess; i++) {
                promises.push(processPage(page + i));
            }

            // Обрабатываем пакет
            const results = await Promise.all(promises);
            for (const result of results) {
                if (result.products.length > 0) {
                    products.push(...result.products);
                }
                if (!result.hasMore) {
                    hasMoreData = false;
                }
            }

            page += pagesToProcess;

            // Добавляем задержку между пакетами, если есть еще страницы
            if (hasMoreData && page <= CONFIG.MAX_PAGES) {
                await setTimeout(CONFIG.BATCH_DELAY);
            }
        }

        return products;
    } catch (error) {
        console.error(`Error parsing products for query "${query}", brand "${selectedBrand}":`, error);
        throw error;
    }
}

async function fetchAndParseProductsByArticle(query, dest, article, queryTime) {
    try {
        const products = [];
        let page = 1;
        let hasMoreData = true;
        const searchQuery = query.toLowerCase();

        const processPage = async (pageNum, retryCount = 0) => {
            try {
                const data = await getProducts(searchQuery, dest, pageNum);
                const productsRaw = data?.data?.products;

                if (!productsRaw || productsRaw.length === 0) {
                    return { products: [], hasMore: false };
                }

                const filteredProducts = productsRaw
                    .map((product, index) => ({ ...product, originalIndex: index + 1 }))
                    .filter(product => product.id == article)
                    .map(product => ({
                        position: product.originalIndex,
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
                    }));

                return {
                    products: filteredProducts,
                    hasMore: filteredProducts.length > 0 && pageNum < CONFIG.MAX_PAGES
                };
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
                products.push(...result.products);
                if (!result.hasMore) {
                    hasMoreData = false;
                }
            }

            page += pagesToProcess;

            if (hasMoreData && page <= CONFIG.MAX_PAGES) {
                await setTimeout(CONFIG.BATCH_DELAY);
            }
        }

        // Обновляем позицию товара с учетом всех страниц
        const productWithArticle = products.find(p => p.id === article);
        if (productWithArticle) {
            productWithArticle.position = products.findIndex(p => p.id === article) + 1;
        }

        return products;
    } catch (error) {
        console.error(`Error parsing products for article "${article}":`, error);
        throw error;
    }
}

module.exports = {
    fetchAndParseProducts,
    fetchAndParseProductsByArticle,
    CONFIG // Экспортируем конфиг для возможности настройки
};