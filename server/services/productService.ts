import { getProducts } from '../api/wildberriesApiUrl';
import { Product } from '../models/product';

// Функция для получения всех продуктов S.Point
export const fetchAndParseProducts = async (query: string): Promise<(Product & { position: number, page: number, queryTime: string })[]> => {
    try {
        const products: (Product & { position: number, page: number, queryTime: string })[] = [];
        const maxConcurrentPages = 18; // Количество параллельных запросов
        let page = 1;
        let hasMoreData = true;

        // Получаем текущее время для добавления к продуктам
        const queryTime = new Date().toISOString();

        // Проверяем, если запрос пустой или равен 'все'
        const searchQuery = query.toLowerCase() === '' ? 'Одежда S.Point' : query;

        // Функция для обработки одной страницы
        const processPage = async (page: number) => {
            const data = await getProducts(searchQuery, page);
            const productsRaw: any[] = data?.data?.products;
            if (!productsRaw || productsRaw.length === 0) {
                hasMoreData = false; // Если данных больше нет, завершаем
                return [];
            }

            // Фильтруем и обрабатываем только продукты с брендом "S.Point"
            return productsRaw
                .filter(product => product.brand === 'S.Point')
                .map(product => ({
                    position: productsRaw.findIndex(p => parseInt(p.id) === product.id) + 1,
                    id: product.id,
                    brand: product.brand,
                    name: product.name,
                    page: page,
                    queryTime: queryTime,  // Добавляем время запроса к продукту
                }));
        };

        // Запускаем параллельные запросы
        while (hasMoreData) {
            const promises = Array.from({ length: maxConcurrentPages }, (_, i) => processPage(page + i));
            const results = await Promise.all(promises);
            for (const result of results) {
                products.push(...result);
            }
            page += maxConcurrentPages; // Переходит к следующим страницам
        }

        console.table(products);
        return products;
    } catch (error) {
        console.error('Error parsing products:', error);
        throw error;
    }
};
