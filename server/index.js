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
const {QueryArticleModel} = require("./models/queryArticleModel");
const {QueryModel} = require("./models/queryModel");
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

// Флаг для отслеживания выполнения задач
const taskState = {
    isMainQueryRunning: false,
    isCleanupRunning: false,
    isDataRemovalRunning: false
};

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

// Основная задача выполнения запросов (каждые 4 часа в :00)
cron.schedule('0 */4 * * *', async () => {
    if (taskState.isMainQueryRunning) {
        console.log('Предыдущая задача выполнения запросов еще выполняется, пропускаем...');
        return;
    }

    try {
        taskState.isMainQueryRunning = true;
        console.log('Запуск основной задачи выполнения запросов...');

        const users = await UserModel.find({});
        await Promise.all(users.map(async user => {
            try {
                await executeUserQueries(user);
            } catch (error) {
                console.error(`Ошибка выполнения запросов для пользователя ${user.email}:`, error);
            }
        }));

        console.log('Основная задача выполнения запросов завершена');
    } catch (error) {
        console.error('Ошибка в основной задаче выполнения запросов:', error);
    } finally {
        taskState.isMainQueryRunning = false;
    }
});

// Задача очистки Google Sheets (каждый день в 00:30)
cron.schedule('30 0 * * *', async () => {
    if (taskState.isCleanupRunning) {
        console.log('Предыдущая задача очистки Google Sheets еще выполняется, пропускаем...');
        return;
    }

    try {
        taskState.isCleanupRunning = true;
        console.log('Запуск задачи очистки Google Sheets...');

        const users = await UserModel.find({ spreadsheetId: { $exists: true } });
        await Promise.all(users.map(async user => {
            try {
                await cleanupOldData(user.spreadsheetId, 'Бренд', 7);
                await cleanupOldData(user.spreadsheetId, 'Артикул', 7);
            } catch (error) {
                console.error(`Ошибка очистки данных для пользователя ${user.email}:`, error);
            }
        }));

        console.log('Задача очистки Google Sheets завершена');
    } catch (error) {
        console.error('Ошибка в задаче очистки Google Sheets:', error);
    } finally {
        taskState.isCleanupRunning = false;
    }
});

// Задача удаления старых данных (каждый день в 03:00)
cron.schedule('0 3 * * *', async () => {
    if (taskState.isDataRemovalRunning) {
        console.log('Предыдущая задача удаления старых данных еще выполняется, пропускаем...');
        return;
    }

    try {
        taskState.isDataRemovalRunning = true;
        console.log('Запуск задачи удаления старых данных...');

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [oldQueries, oldArticleQueries] = await Promise.all([
            QueryModel.find({ createdAt: { $lt: weekAgo } }).lean().exec(),
            QueryArticleModel.find({ createdAt: { $lt: weekAgo } }).lean().exec()
        ]);

        // Удаляем документы с вызовом middleware
        await Promise.all([
            ...oldQueries.map(q => QueryModel.deleteOne({ _id: q._id }).exec()),
            ...oldArticleQueries.map(q => QueryArticleModel.deleteOne({ _id: q._id }).exec())
        ]);

        console.log(`Удалено ${oldQueries.length} запросов и ${oldArticleQueries.length} запросов по артикулам`);
    } catch (error) {
        console.error('Ошибка в задаче удаления старых данных:', error);
    } finally {
        taskState.isDataRemovalRunning = false;
    }
});

const startServer = () => {
    autoQueryService.init().then(() => {
        console.log('AutoQueryService инициализирован');
    }).catch(err => {
        console.error('Ошибка инициализации AutoQueryService:', err);
    });

    app.use('/api/admin', adminRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/otp', otpRoutes);
    app.use('/api/article', protect, queryArticleRoutes);
    app.use('/api/queries', protect, queryRoutes);
    app.use('/api/user', protect, userRoutes);

    app.listen(port, () => {
        console.log(`Сервер работает на http://localhost:${port}`);
    });
};

connectWithRetry();