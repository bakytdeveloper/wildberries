const { getProducts } = require('../api/wildberriesApiUrl');

const cityDestinations = {
    '-1275551': 'г.Москва',
    '-1123300': 'г.Санкт-Петербург',
    '123589350': 'г.Дмитров',
    '12358062': 'г.Краснодар',
    '-2133463': 'г.Казань',
    '286': 'г.Бишкек'
};

function generateImageUrl(id) {
    const t = Math.floor(id / 1e5);
    const ranges = { 143: "01", 287: "02", 431: "03", 719: "04", 1007: "05", 1061: "06", 1115: "07", 1169: "08", 1313: "09", 1601: "10", 1655: "11", 1919: "12", 2045: "13", 2189: "14", 2405: "15", 2621: "16", 2837: "17", 3053: "18", 3269: "19", 3485: "20" };
    let r = "21";
    for (const [key, value] of Object.entries(ranges)) {
        if (t <= parseInt(key)) {
            r = value;
            break;
        }
    }
    const vol = `vol${t}`;
    const part = `part${Math.floor(id / 1e3)}`;
    return `https://basket-${r}.wbbasket.ru/${vol}/${part}/${id}/images/c516x688/1.webp`;
}

async function fetchAndParseProducts(query, dest, selectedBrand, queryTime) {
    try {
        const products = [];
        const maxConcurrentPages = 4;
        let page = 1;
        let hasMoreData = true;
        const baseQuery = selectedBrand === 'S.Point' ? 'Одежда S.Point' : '';
        const searchQuery = query.toLowerCase() === '' ? `${baseQuery} ${selectedBrand.toLowerCase()}` : query.toLowerCase();

        const processPage = async (page) => {
            const data = await getProducts(searchQuery, dest, page);
            const productsRaw = data?.data?.products;
            if (!productsRaw || productsRaw.length === 0) {
                hasMoreData = false;
                return [];
            }
            return productsRaw
                .filter(product => product.brand.toLowerCase() === selectedBrand.toLowerCase())
                .map(product => ({
                    position: productsRaw.findIndex(p => parseInt(p.id) === product.id) + 1,
                    id: product.id,
                    brand: product.brand,
                    name: product.name,
                    page: page,
                    dest: dest,
                    city: cityDestinations[dest] || 'Неизвестный город',
                    query: query,
                    queryTime: queryTime,
                    imageUrl: generateImageUrl(product.id),
                    log: product.log
                }));
        };

        while (hasMoreData) {
            const promises = Array.from({ length: maxConcurrentPages }, (_, i) => processPage(page + i));
            const results = await Promise.all(promises);
            for (const result of results) {
                products.push(...result);
            }
            page += maxConcurrentPages;
        }
        return products;
    } catch (error) {
        console.error('Error parsing products:', error);
        throw error;
    }
}

async function fetchAndParseProductsByArticle(query, dest, article, queryTime) {
    try {
        const products = [];
        const maxConcurrentPages = 4;
        let page = 1;
        let hasMoreData = true;
        const searchQuery = query.toLowerCase();

        const processPage = async (page) => {
            const data = await getProducts(searchQuery, dest, page);
            const productsRaw = data?.data?.products;
            if (!productsRaw || productsRaw.length === 0) {
                hasMoreData = false;
                return [];
            }
            return productsRaw
                .map((product, index) => ({ ...product, originalIndex: index + 1 }))
                .filter(product => product.id == article)
                .map((product) => ({
                    position: product.originalIndex,
                    id: product.id,
                    brand: product.brand,
                    name: product.name,
                    page: page,
                    dest: dest,
                    city: cityDestinations[dest] || 'Неизвестный город',
                    query: query,
                    queryTime: queryTime,
                    imageUrl: generateImageUrl(product.id),
                    log: product.log
                }));
        };

        while (hasMoreData) {
            const promises = Array.from({ length: maxConcurrentPages }, (_, i) => processPage(page + i));
            const results = await Promise.all(promises);
            for (const result of results) {
                products.push(...result);
            }
            page += maxConcurrentPages;
        }

        const productWithArticle = products.find(product => product.id === article);

        if (productWithArticle) {
            productWithArticle.position = products.findIndex(product => product.id === article) + 1;
        }

        return products;
    } catch (error) {
        console.error('Error parsing products:', error);
        throw error;
    }
}

module.exports = {
    fetchAndParseProducts,
    fetchAndParseProductsByArticle
};
