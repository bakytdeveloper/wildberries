const cron = require('node-cron');
const { QueryModel } = require('../models/queryModel');
const { QueryArticleModel } = require('../models/queryArticleModel');
const { UserModel } = require('../models/userModel');
const { fetchAndParseProducts } = require('./productService');
const { fetchAndParseProductsByArticle } = require('./productService');

class AutoQueryService {
    constructor() {
        this.scheduledJobs = new Map();
        this.cityDestinations = {
            '-1275551': 'г.Москва',
            '-1123300': 'г.Санкт-Петербург',
            '123589350': 'г.Дмитров',
            '12358062': 'г.Краснодар',
            '-2133463': 'г.Казань',
            '286': 'г.Бишкек'
        };
    }

    async init() {
        const users = await UserModel.find({});
        for (const user of users) {
            await this.scheduleAutoQueriesForUser(user._id);
        }
    }

    async scheduleAutoQueriesForUser(userId) {
        try {
            this.stopAutoQueriesForUser(userId);
            const user = await UserModel.findById(userId).populate('queries');
            if (!user) return;

            const [brandCombinations, articleCombinations] = await Promise.all([
                this.getUniqueBrandCombinations(userId),
                this.getUniqueArticleCombinations(userId)
            ]);

            if (brandCombinations.length > 0 || articleCombinations.length > 0) {
                // Изменил на 10 минут после часа
                const job = cron.schedule('10 */4 * * *', async () => {
                    try {
                        console.log(`Running auto queries for user ${userId}`);
                        await this.executeAutoQueries(userId, brandCombinations, articleCombinations);
                    } catch (error) {
                        console.error(`Error in auto queries for user ${userId}:`, error);
                    }
                });

                this.scheduledJobs.set(userId.toString(), job);
                console.log(`Scheduled auto queries for user ${userId}`);
            }
        } catch (error) {
            console.error(`Error scheduling auto queries for user ${userId}:`, error);
        }
    }


    async getUniqueBrandCombinations(userId) {
        const queries = await QueryModel.find({ userId });
        const combinations = new Map();

        for (const query of queries) {
            const queriesArr = this.safeSplit(query.query);
            const brandsArr = this.safeSplit(query.brand);
            const citiesArr = this.safeSplit(query.city);
            const destsArr = query.dest ? this.safeSplit(query.dest) : [];

            const maxLength = Math.max(
                queriesArr.length,
                brandsArr.length,
                citiesArr.length,
                destsArr.length
            );

            for (let i = 0; i < maxLength; i++) {
                const q = queriesArr[i]?.trim() || '';
                const brand = brandsArr[i]?.trim() || '';
                const city = citiesArr[i]?.trim() || '';
                let dest = destsArr[i]?.trim() || '';

                if (!dest && city) {
                    const cityKey = Object.keys(this.cityDestinations).find(
                        key => this.cityDestinations[key] === city
                    );
                    dest = cityKey || '';
                }

                if (q && brand && city && dest) {
                    const key = `${q.toLowerCase()}|${brand.toLowerCase()}|${city.toLowerCase()}`;
                    if (!combinations.has(key)) {
                        combinations.set(key, {
                            query: q,
                            brand,
                            city,
                            dest
                        });
                    }
                }
            }
        }

        return Array.from(combinations.values());
    }

    async getUniqueArticleCombinations(userId) {
        const queries = await QueryArticleModel.find({ userId });
        const combinations = new Map();

        for (const query of queries) {
            const queriesArr = this.safeSplit(query.query);
            const articlesArr = this.safeSplit(query.article);
            const citiesArr = this.safeSplit(query.city);
            const destsArr = query.dest ? this.safeSplit(query.dest) : [];

            const maxLength = Math.max(
                queriesArr.length,
                articlesArr.length,
                citiesArr.length,
                destsArr.length
            );

            for (let i =  0; i < maxLength; i++) {
                const q = queriesArr[i]?.trim() || '';
                const article = articlesArr[i]?.trim() || '';
                const city = citiesArr[i]?.trim() || '';
                let dest = destsArr[i]?.trim() || '';

                if (!dest && city) {
                    const cityKey = Object.keys(this.cityDestinations).find(
                        key => this.cityDestinations[key] === city
                    );
                    dest = cityKey || '';
                }

                if (q && article && city && dest) {
                    const key = `${q.toLowerCase()}|${article.toLowerCase()}|${city.toLowerCase()}`;
                    if (!combinations.has(key)) {
                        combinations.set(key, {
                            query: q,
                            article,
                            city,
                            dest
                        });
                    }
                }
            }
        }

        return Array.from(combinations.values());
    }

    safeSplit(str) {
        if (!str || typeof str !== 'string') return [];
        return str.split('; ').filter(item => item.trim() !== '');
    }

    async executeAutoQueries(userId, brandCombinations, articleCombinations) {
        try {
            await Promise.all([
                brandCombinations.length > 0 && this.executeBrandQueries(userId, brandCombinations),
                articleCombinations.length > 0 && this.executeArticleQueries(userId, articleCombinations)
            ]);
        } catch (error) {
            console.error(`Error executing auto queries for user ${userId}:`, error);
            throw error;
        }
    }

    async executeBrandQueries(userId, combinations) {
        try {
            const timestamp = Date.now();
            const productTables = await Promise.all(
                combinations.map(async (comb, index) => {
                    const products = await fetchAndParseProducts(
                        comb.query,
                        comb.dest,
                        comb.brand,
                        new Date().toISOString()
                    );
                    return {
                        tableId: `auto-${timestamp}-${index}`,
                        products
                    };
                })
            );

            // Фильтруем пустые результаты
            const validTables = productTables.filter(table => table.products.length > 0);
            if (validTables.length === 0) return;

            const newQuery = new QueryModel({
                userId,
                query: combinations.map(c => c.query).join('; '),
                dest: combinations.map(c => c.dest).join('; '),
                productTables: validTables,
                createdAt: new Date(),
                city: combinations.map(c => c.city).join('; '),
                brand: combinations.map(c => c.brand).join('; '),
                isAutoQuery: true
            });

            await newQuery.save();
            await UserModel.findByIdAndUpdate(userId, { $push: { queries: newQuery._id } });
        } catch (error) {
            console.error('Error executing brand queries:', error);
            throw error;
        }
    }

    async executeArticleQueries(userId, combinations) {
        try {
            const timestamp = Date.now();
            const productTables = await Promise.all(
                combinations.map(async (comb, index) => {
                    const products = await fetchAndParseProductsByArticle(
                        comb.query,
                        comb.dest,
                        comb.article,
                        new Date().toISOString()
                    );
                    return {
                        tableId: `auto-${timestamp}-${index}`,
                        products
                    };
                })
            );

            // Фильтруем пустые результаты
            const validTables = productTables.filter(table => table.products.length > 0);
            if (validTables.length === 0) return;

            const newQuery = new QueryArticleModel({
                userId,
                query: combinations.map(c => c.query).join('; '),
                article: combinations.map(c => c.article).join('; '),
                dest: combinations.map(c => c.dest).join('; '),
                productTables: validTables,
                createdAt: new Date(),
                city: combinations.map(c => c.city).join('; '),
                isAutoQuery: true
            });

            await newQuery.save();
            await UserModel.findByIdAndUpdate(userId, { $push: { queries: newQuery._id } });
        } catch (error) {
            console.error('Error executing article queries:', error);
            throw error;
        }
    }

    stopAutoQueriesForUser(userId) {
        const userIdStr = userId.toString();
        if (this.scheduledJobs.has(userIdStr)) {
            this.scheduledJobs.get(userIdStr).stop();
            this.scheduledJobs.delete(userIdStr);
            console.log(`Stopped auto queries for user ${userId}`);
        }
    }
}

const autoQueryService = new AutoQueryService();
module.exports = { autoQueryService };