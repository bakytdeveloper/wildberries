const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const queryRoutes = require('./routes/queryRoutes');
const authRoutes = require('./routes/authRoutes');
const { protect } = require('./middleware/authMiddleware');
const otpRoutes = require('./routes/otpRoutes');
const userRoutes = require('./routes/userRoutes');
const queryArticleRoutes = require('./routes/queryArticleRoutes');
const adminRoutes = require('./routes/adminRoutes');
const path = require('path');
const {addDataToSheet} = require("./services/googleSheetService");
const {QueryModel} = require("./models/queryModel");
const {QueryArticleModel} = require("./models/queryArticleModel");
const {fetchAndParseProducts} = require("./services/productService");
const {fetchAndParseProductsByArticle} = require("./services/productService");
const {UserModel} = require("./models/userModel"); // Добавляем модуль path для работы с путями
const cron = require('node-cron');

dotenv.config();

const app = express();
const urlMongo = process.env.MONGODB_URI;
const port = process.env.PORT || 5505;

app.use(cors());
app.use(express.json());

// Добавляем middleware для обслуживания статических файлов из папки excelFiles
app.use('/excelFiles', express.static(path.join(__dirname, 'excelFiles')));

console.log('MONGODB_URI:', urlMongo); // Логирование строки подключения

const connectWithRetry = () => {
    mongoose.connect(urlMongo, { serverSelectionTimeoutMS: 5000 })
        .then(() => {
            console.log('Connected to MongoDB');
            startServer();
        })
        .catch((error) => {
            console.error('Error connecting to MongoDB:', error.message);
            setTimeout(connectWithRetry, 5000);
        });
};

// Функция для выполнения всех запросов пользователя
const executeUserQueries = async (user) => {
    try {
        // Получаем все запросы пользователя
        const queries = await QueryModel.find({ userId: user._id });
        const articleQueries = await QueryArticleModel.find({ userId: user._id });

        // Уникальные запросы по бренду
        const uniqueBrandQueries = new Set();
        const uniqueBrandRequests = [];

        // Уникальные запросы по артикулу
        const uniqueArticleQueries = new Set();
        const uniqueArticleRequests = [];

        // Обработка запросов по бренду
        for (const query of queries) {
            const queriesArray = query.query.split('; ');
            const destsArray = query.dest.split('; ');
            const citiesArray = query.city.split('; ');
            const brandsArray = query.brand.split('; ');

            for (let i = 0; i < queriesArray.length; i++) {
                const queryText = queriesArray[i].trim();
                const dest = destsArray[i].trim();
                const city = citiesArray[i].trim();
                const brand = brandsArray[i].trim();

                // Создаем уникальный ключ для проверки дубликатов
                const uniqueKey = `${queryText}|${brand}|${city}`;

                // Если запрос уникальный, добавляем его в список
                if (!uniqueBrandQueries.has(uniqueKey)) {
                    uniqueBrandQueries.add(uniqueKey);
                    uniqueBrandRequests.push({ queryText, dest, city, brand });
                }
            }
        }

        // Обработка запросов по артикулу
        for (const query of articleQueries) {
            const queriesArray = query.query.split('; ');
            const articlesArray = query.article.split('; ');
            const destsArray = query.dest.split('; ');
            const citiesArray = query.city.split('; ');

            for (let i = 0; i < queriesArray.length; i++) {
                const queryText = queriesArray[i].trim();
                const article = articlesArray[i].trim();
                const dest = destsArray[i].trim();
                const city = citiesArray[i].trim();

                // Создаем уникальный ключ для проверки дубликатов
                const uniqueKey = `${queryText}|${article}|${city}`;

                // Если запрос уникальный, добавляем его в список
                if (!uniqueArticleQueries.has(uniqueKey)) {
                    uniqueArticleQueries.add(uniqueKey);
                    uniqueArticleRequests.push({ queryText, city, dest, article });
                }
            }
        }

        // Выполняем уникальные запросы по бренду
        for (const request of uniqueBrandRequests) {
            const { queryText, dest, city, brand } = request;

            const products = await fetchAndParseProducts(queryText, dest, brand, new Date().toISOString());
            const data = products.map(product => [
                String(product.query),
                String(product.brand),
                String(product.city),
                String(product.imageUrl),
                String(product.id),
                String(product.name),
                // Объединяем страницу и позицию в одну ячейку с учетом условий
                `${product.page === 1 ? '' : product.page}${String(product.position).padStart(2, '0')}`,
                String(product.log?.position || `${product.page === 1 ? '' : product.page}${String(product.position).padStart(2, '0')}`),
                new Date(product.queryTime).toLocaleTimeString(),
                new Date(product.queryTime).toLocaleDateString(),
            ]);

            await addDataToSheet(user.spreadsheetId, 'Бренд', data);
        }

// Выполняем уникальные запросы по артикулу
        for (const request of uniqueArticleRequests) {
            const { queryText, dest, city, article } = request;
            console.log(`Обработка запроса по артикулу: query=${queryText}, city=${city}, city=${city}, article=${article}`);

            const products = await fetchAndParseProductsByArticle(queryText, dest, article, new Date().toISOString());

            console.log("products:", products);

            const data = products.map(product => [
                String(product.query),
                String(product.id),
                String(product.city),
                String(product.imageUrl),
                String(product.brand),
                String(product.name),
                // Объединяем страницу и позицию в одну ячейку с учетом условий
                `${product.page === 1 ? '' : product.page}${String(product.position).padStart(2, '0')}`,
                String(product.log?.position || `${product.page === 1 ? '' : product.page}${String(product.position).padStart(2, '0')}`),
                new Date(product.queryTime).toLocaleTimeString(),
                new Date(product.queryTime).toLocaleDateString(),
            ]);

            await addDataToSheet(user.spreadsheetId, 'Артикул', data);
        }
    } catch (error) {
        console.error(`Ошибка выполнения запросов для пользователя ${user.email}:`, error);
    }
};

// Задача для выполнения каждые 40 минут
cron.schedule('*/3 * * * *', async () => {
    try {
        const users = await UserModel.find({});
        for (const user of users) {
            await executeUserQueries(user);
        }
    } catch (error) {
        console.error('Ошибка выполнения задачи:', error);
    }
});


const startServer = () => {
    app.use('/api/admin', adminRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/otp', otpRoutes);
    app.use('/api/article', protect, queryArticleRoutes);
    app.use('/api/queries', protect, queryRoutes);
    app.use('/api/user', protect, userRoutes); // Добавляем маршрут для профиля пользователя
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
};

connectWithRetry();