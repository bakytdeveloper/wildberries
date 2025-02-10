import axios from 'axios';
import axiosRetry from 'axios-retry';
const apiUrl = 'https://search.wb.ru/exactmatch/sng/common/v9/search';

// Настраиваем axios для повторных попыток в случае ошибки
axiosRetry(axios, { retries: 3, retryDelay: (retryCount) => retryCount * 100, retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error) });

export const getProducts = async (query: string, dest: string, page: number = 1): Promise<any> => {
    try {
        const url = apiUrl;
        const params: any = {
            'ab_testid': 'false',
            'appType': '1',
            'curr': 'rub',
            'dest': dest, // Динамическое значение для dest
            'hide_dtype': '10',
            'lang': 'ru',
            'page': page.toString(),
            'query': query,
            'resultset': 'catalog',
            'sort': 'popular',
            'spp': '30',
            'suppressSpellcheck': 'false'
        };

        const response = await axios.get(url, {
            params: params,
        });

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error fetching products:', error.response?.data || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
        throw error;
    }
};
