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
const cron = require("node-cron");
const {cleanupOldData} = require("./services/googleSheetService");
const { UserModel } = require("./models/userModel");
const { executeUserQueries } = require("./services/queryService");
const { autoQueryService } = require('./services/autoQueryService');

dotenv.config();

const app = express();
const urlMongo = process.env.MONGODB_URI;
const port = process.env.PORT || 5505;

app.use(cors());
app.use(express.json());

const connectWithRetry = () => {
    mongoose.connect(urlMongo, { serverSelectionTimeoutMS: 5000 })
        .then(() => {
            console.log('Connected to MongoDB');
            startServer();
        })
        .catch((error) => {
            console.error('Ошибка подключения к MongoDB:', error.message);
            setTimeout(connectWithRetry, 5000);
        });
};

// Задача для выполнения каждые 4 часов
// cron.schedule('*/5 * * * *', async () => {
cron.schedule('0 */4 * * *', async () => {
    try {
        const users = await UserModel.find({});
        for (const user of users) {
            await executeUserQueries(user);
        }
    } catch (error) {
        console.error('Ошибка выполнения задачи:', error);
    }
});

// Задача для очистки старых данных каждые 24 часа
cron.schedule('0 0 * * *', async () => {
    try {
        const users = await UserModel.find({ spreadsheetId: { $exists: true } });
        for (const user of users) {
            try {
                await cleanupOldData(user.spreadsheetId, 'Бренд', 7); // Для SearchByBrand
                await cleanupOldData(user.spreadsheetId, 'Артикул', 7); // Для SearchByArticle
            } catch (error) {
                console.error(`Ошибка очистки данных для пользователя ${user.email}:`, error);
            }
        }
    } catch (error) {
        console.error('Ошибка выполнения задачи очистки:', error);
    }
});

const startServer = () => {
    autoQueryService.init().then(r => r);
    app.use('/api/admin', adminRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/otp', otpRoutes);
    app.use('/api/article', protect, queryArticleRoutes);
    app.use('/api/queries', protect, queryRoutes);
    app.use('/api/user', protect, userRoutes); // Добавляем маршрут для профиля пользователя
    app.listen(port, () => {
        console.log(`Сервер работает на http://localhost:${port}`);
    });
};

connectWithRetry();