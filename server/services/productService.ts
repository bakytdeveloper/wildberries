import { getProducts } from '../api/wildberriesApiUrl';
import { Product } from '../models/product';

function generateImageUrl(id: number): string {
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


export const fetchAndParseProducts = async (query: string, dest: string, selectedBrand: string, queryTime: string): Promise<(Product & { position: number, page: number, queryTime: string })[]> => {
    try {
        const products: (Product & { position: number, page: number, queryTime: string })[] = [];
        const maxConcurrentPages = 18;
        let page = 1;
        let hasMoreData = true;
        const baseQuery = selectedBrand === 'S.Point' ? 'Одежда S.Point' : '';
        const searchQuery = query.toLowerCase() === '' ? `${baseQuery} ${selectedBrand.toLowerCase()}` : query.toLowerCase();

        const processPage = async (page: number) => {
            const data = await getProducts(searchQuery, dest, page);
            const productsRaw: any[] = data?.data?.products;
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
                    queryTime: queryTime,
                    imageUrl: generateImageUrl(product.id),
                    log: product.log // Добавляем лог
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
};






export const fetchAndParseProductsByArticle = async (
    query: string,
    dest: string,
    article: string, // артикул товара
    queryTime: string
): Promise<(Product & { position: number, page: number, queryTime: string })[]> => {
    try {
        const products: (Product & { position: number, page: number, queryTime: string })[] = [];
        const maxConcurrentPages = 18;
        let page = 1;
        let hasMoreData = true;
        const searchQuery = query.toLowerCase();

        const processPage = async (page: number) => {
            const data = await getProducts(searchQuery, dest, page);
            const productsRaw: any[] = data?.data?.products;
            if (!productsRaw || productsRaw.length === 0) {
                hasMoreData = false;
                return [];
            }
            return productsRaw
                .filter(product => product.id == article)
                .map((product, index) => ({
                position: index + 1,
                id: product.id,
                brand: product.brand,
                name: product.name,
                page: page,
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

        // Находим фактическую позицию товара по артикулу
        const productWithArticle = products.find(product => product.id === article);

        // Если товар найден, обновляем его позицию
        if (productWithArticle) {
            productWithArticle.position = products.findIndex(product => product.id === article) + 1;
        }

        return products;
    } catch (error) {
        console.error('Error parsing products:', error);
        throw error;
    }
};