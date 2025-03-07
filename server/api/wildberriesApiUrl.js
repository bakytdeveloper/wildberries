const axios = require('axios');
const axiosRetry = require('axios-retry');
const apiUrl = 'https://search.wb.ru/exactmatch/sng/common/v9/search';

// Настраиваем axios для повторных попыток в случае ошибки
axiosRetry.default(axios, {
    retries: 3,
    retryDelay: (retryCount) => retryCount * 100,
    retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error)
});

const getProducts = async (query, dest, page = 1) => {
    try {
        const url = apiUrl;
        const params = {
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

        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        if (error && typeof error === 'object' && error.response) {
            console.error('Error fetching products:', error.response?.data || error.message);
        } else if (error instanceof Error) {
            console.error('Unexpected error:', error.message);
        } else {
            console.error('Unexpected error:', error);
        }
        throw error;
    }
};

module.exports = { getProducts };