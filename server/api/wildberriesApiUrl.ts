import axios from 'axios';
import axiosRetry from 'axios-retry';

const apiUrl = 'https://search.wb.ru/exactmatch/sng/common/v9/search';
const fallbackApiUrl = 'https://recom.wb.ru/personal/sng/common/v5/search';

// Настраиваем axios для повторных попыток в случае ошибки
axiosRetry(axios, {
    retries: 3, // Количество попыток
    retryDelay: (retryCount) => retryCount * 100, // Задержка между попытками
    retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error)
});

export const getProducts = async (query: string, page: number = 1): Promise<any> => {
    try {
        let url = apiUrl;
        const params: any = {
            'ab_testid': 'promo_mask_high_rel_release',
            'appType': '1',
            'curr': 'rub',
            'dest': '123589350',
            'hide_dtype': '10',
            'lang': 'ru',
            'page': page.toString(),
            'query': query,
            'resultset': 'catalog',
            'sort': 'popular',
            'spp': '30',
            'suppressSpellcheck': 'false'
        };

        if (query === '1') {
            url = fallbackApiUrl; // Если запрос пустой или равен '1', используем другой URL
            Object.assign(params, {
                'ab_compl_lightfm_v2': 'ab_rank_concat',
                'ab_rec_testid': 'rec_action_promo1',
                'resultset': 'catalog'
            });
            params.query = '1';
        }

        const response = await axios.get(url, {
            params: params,
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
                'clicks': '283261808=1737526157;150458803=1737526132;150459664=1737472091;295809738=1737470877;223030610=1737461263;295984224=1737460502',
                'origin': 'https://www.wildberries.ru',
                'priority': 'u=1, i',
                'referer': 'https://www.wildberries.ru/',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'x-captcha-id': 'Catalog 1|1|1738668904|AA==|42684a65103249b09c6b00220f906716|kiLemWm50jddRMqPVtwyhYkj8G7JoTPbrD14XTWCVd3'
            }
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
