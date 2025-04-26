const cron = require('node-cron');
const { executeUserQueries } = require("./queryService");
const { QueryModel } = require('../models/queryModel');
const { QueryArticleModel } = require('../models/queryArticleModel');
const { UserModel } = require('../models/userModel');
const { fetchAndParseProducts } = require('./productService');
const { fetchAndParseProductsByArticle } = require('./productService');
const { setTimeout } = require('timers/promises');

class AutoQueryService {
    constructor() {
        // Используем WeakMap для хранения задач, чтобы избежать утечек памяти
        this.scheduledJobs = new WeakMap();
        this.activeUsers = new Set();
        this.cityDestinations = {
            '-2162195': 'г.Москва',
            '-1123300': 'г.Санкт-Петербург',
            '123589350': 'г.Дмитров',
            '12358062': 'г.Краснодар',
            '-2133463': 'г.Казань',
            '286': 'г.Бишкек'
        };
        this.BATCH_SIZE = 5;
        this.BATCH_DELAY = 10000;
    }

    async processAllUsers() {
        try {
            const users = await UserModel.find({ isBlocked: false }).lean();

            if (!Array.isArray(users)) {
                throw new Error('Expected users to be an array');
            }

            if (users.length === 0) {
                console.log('No users to process');
                return;
            }

            for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
                const batch = users.slice(i, i + this.BATCH_SIZE);
                await this.processUserBatch(batch);

                if (i + this.BATCH_SIZE < users.length) {
                    await setTimeout(this.BATCH_DELAY);
                }
            }
        } catch (error) {
            console.error('Error in processAllUsers:', error);
            throw error;
        }
    }


    async processUserWithDataExport(userId) {
        try {
            const user = await UserModel.findById(userId).lean();
            if (!user || user.isBlocked) {
                console.log(`Пользователь ${userId} заблокирован, пропускаем обработку`);
                return;
            }

            await this.scheduleAutoQueriesForUser(userId);

            if (!user.spreadsheetId) return;

            const [latestBrandQuery, latestArticleQuery] = await Promise.all([
                QueryModel.findOne({ userId, isAutoQuery: true })
                    .sort({ createdAt: -1 })
                    .populate('productTables.products')
                    .lean(),
                QueryArticleModel.findOne({ userId, isAutoQuery: true })
                    .sort({ createdAt: -1 })
                    .populate('productTables.products')
                    .lean()
            ]);

            if (latestBrandQuery || latestArticleQuery) {
                await executeUserQueries(user);
                console.log(`Данные для пользователя ${user.email} успешно экспортированы`);
            }
        } catch (error) {
            console.error(`Ошибка обработки пользователя ${userId}:`, error);
        }
    }

    async processUserBatch(users) {
        try {
            await Promise.all(users.map(user =>
                this.processUserWithDataExport(user._id)
            ));
        } catch (error) {
            console.error('Error in processUserBatch:', error);
        }
    }

    async scheduleAutoQueriesForUser(userId) {
        const user = await UserModel.findById(userId).lean();
        if (!user || user.isBlocked) {
            console.log(`Пользователь ${userId} заблокирован, запросы отменены`);
            return;
        }

        const userIdStr = userId.toString();
        if (this.activeUsers.has(userIdStr)) {
            return;
        }

        this.activeUsers.add(userIdStr);
        try {
            const [brandCombinations, articleCombinations] = await Promise.all([
                this.getUniqueBrandCombinations(userId),
                this.getUniqueArticleCombinations(userId)
            ]);

            if (brandCombinations.length > 0 || articleCombinations.length > 0) {
                await this.executeAutoQueries(userId, brandCombinations, articleCombinations);
            }
        } catch (error) {
            console.error(`Error in auto queries for user ${userId}:`, error);
        } finally {
            this.activeUsers.delete(userIdStr);
        }
    }

    async getUniqueBrandCombinations(userId) {
        const user = await UserModel.findById(userId).lean();
        if (!user || user.isBlocked) return [];

        const queries = await QueryModel.find({ userId }).lean();
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
        const user = await UserModel.findById(userId).lean();
        if (!user || user.isBlocked) return [];

        const queries = await QueryArticleModel.find({ userId }).lean();
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

            for (let i = 0; i < maxLength; i++) {
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
                    try {
                        const products = await fetchAndParseProducts(
                            comb.query,
                            comb.dest,
                            comb.brand,
                            new Date().toISOString()
                        );
                        return products.length > 0
                            ? { tableId: `auto-${timestamp}-${index}`, products }
                            : null;
                    } catch (error) {
                        console.error(`Error fetching products for brand query ${comb.query}:`, error);
                        return null;
                    }
                })
            );

            const validTables = productTables.filter(Boolean);
            if (validTables.length === 0) return;

            const newQuery = new QueryModel({
                userId,
                query: combinations.filter((_, i) => productTables[i] !== null).map(c => c.query).join('; '),
                dest: combinations.filter((_, i) => productTables[i] !== null).map(c => c.dest).join('; '),
                productTables: validTables,
                createdAt: new Date(),
                city: combinations.filter((_, i) => productTables[i] !== null).map(c => c.city).join('; '),
                brand: combinations.filter((_, i) => productTables[i] !== null).map(c => c.brand).join('; '),
                isAutoQuery: true
            });

            await newQuery.save();
            await UserModel.findByIdAndUpdate(userId, { $push: { requests: newQuery._id } });

        } catch (error) {
            console.error('Ошибка выполнения бренд-запросов:', error);
            throw error;
        }
    }

    async executeArticleQueries(userId, combinations) {
        try {
            const timestamp = Date.now();
            const productTables = await Promise.all(
                combinations.map(async (comb, index) => {
                    try {
                        const products = await fetchAndParseProductsByArticle(
                            comb.query,
                            comb.dest,
                            comb.article,
                            new Date().toISOString()
                        );
                        return products.length > 0
                            ? { tableId: `auto-${timestamp}-${index}`, products }
                            : null;
                    } catch (error) {
                        console.error(`Error fetching products for article query ${comb.query}:`, error);
                        return null;
                    }
                })
            );

            const validTables = productTables.filter(Boolean);
            if (validTables.length === 0) return;

            const newQuery = new QueryArticleModel({
                userId,
                query: combinations.filter((_, i) => productTables[i] !== null).map(c => c.query).join('; '),
                article: combinations.filter((_, i) => productTables[i] !== null).map(c => c.article).join('; '),
                dest: combinations.filter((_, i) => productTables[i] !== null).map(c => c.dest).join('; '),
                productTables: validTables,
                createdAt: new Date(),
                city: combinations.filter((_, i) => productTables[i] !== null).map(c => c.city).join('; '),
                isAutoQuery: true
            });

            await newQuery.save();
            await UserModel.findByIdAndUpdate(userId, { $push: { requests: newQuery._id } });

        } catch (error) {
            console.error('Ошибка выполнения артикул-запросов:', error);
            throw error;
        }
    }

    stopAutoQueriesForUser(userId) {
        const userIdStr = userId.toString();
        if (this.activeUsers.has(userIdStr)) {
            this.activeUsers.delete(userIdStr);
        }
    }

    cleanup() {
        this.activeUsers.clear();
    }
}

const autoQueryService = new AutoQueryService();

module.exports = { autoQueryService };