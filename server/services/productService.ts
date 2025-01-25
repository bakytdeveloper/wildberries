import { getProducts } from '../api/wildberriesApiUrl';
import { Product } from '../models/product';

export const fetchAndParseProducts = async (query: string, dest: string): Promise<(Product & { position: number, page: number, queryTime: string })[]> => {
    try {
        const products: (Product & { position: number, page: number, queryTime: string })[] = [];
        const maxConcurrentPages = 18; // Количество параллельных запросов
        let page = 1;
        let hasMoreData = true;

        // Получаем текущее время для добавления к продуктам
        const queryTime = new Date().toISOString();
        const searchQuery = query.toLowerCase() === '' ? 'Одежда S.Point' : query;

        const processPage = async (page: number) => {
            const data = await getProducts(searchQuery, dest, page); // Добавляем dest
            const productsRaw: any[] = data?.data?.products;
            if (!productsRaw || productsRaw.length === 0) {
                hasMoreData = false;
                return [];
            }

            return productsRaw
                .filter(product => product.brand === 'S.Point')
                .map(product => ({
                    position: productsRaw.findIndex(p => parseInt(p.id) === product.id) + 1,
                    id: product.id,
                    brand: product.brand,
                    name: product.name,
                    page: page,
                    queryTime: queryTime
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

        console.table(products);
        return products;
    } catch (error) {
        console.error('Error parsing products:', error);
        throw error;
    }
};
