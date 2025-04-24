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
const cron = require("node-cron");
const {checkSubscriptions} = require("./controllers/adminController");
const {QueryArticleModel} = require("./models/queryArticleModel");
const {QueryModel} = require("./models/queryModel");
const {cleanupOldData} = require("./services/googleSheetService");
const { UserModel } = require("./models/userModel");
const { executeUserQueries } = require("./services/queryService");
const { autoQueryService } = require('./services/autoQueryService');
const { checkTrialPeriods } = require('./services/trialService');

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
    isDataRemovalRunning: false,
    isTrialCheckRunning: false,
    isSubscriptionCheckRunning: false
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

// Задача очистки Google Sheets (каждый день в 02:00)
cron.schedule('0 2 * * *', async () => {
    if (taskState.isCleanupRunning) {
        return;
    }

    try {
        taskState.isCleanupRunning = true;
        console.log('Запуск задачи очистки Google Sheets...');

        // Получаем пользователей с существующими spreadsheetId
        const users = await UserModel.find({ spreadsheetId: { $exists: true } }).lean();

        if (Array.isArray(users)) {
            for (const user of users) {
                try {
                    await cleanupOldData(user.spreadsheetId, 'Бренд', 7);
                    await cleanupOldData(user.spreadsheetId, 'Артикул', 7);
                } catch (error) {
                    console.error(`Ошибка очистки данных для пользователя ${user.email}:`, error);
                }
            }
        } else {
            console.error('Ошибка: ожидается массив пользователей');
        }

        console.log('Задача очистки Google Sheets завершена');
    } catch (error) {
        console.error('Ошибка в задаче очистки Google Sheets:', error);
    } finally {
        taskState.isCleanupRunning = false;
    }
});

cron.schedule('*/5 * * * *', async () => {
// cron.schedule('0 4 * * *', async () => {
    if (taskState.isSubscriptionCheckRunning) return;

    try {
        taskState.isSubscriptionCheckRunning = true;
        console.log('Запуск проверки фактических подписок...');
        await checkSubscriptions();
    } catch (error) {
        console.error('Ошибка при проверке подписок:', error);
    } finally {
        taskState.isSubscriptionCheckRunning = false;
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

        // 1. Находим старые запросы
        const [oldQueries, oldArticleQueries] = await Promise.all([
            QueryModel.find({ createdAt: { $lt: weekAgo } }).lean().exec(),
            QueryArticleModel.find({ createdAt: { $lt: weekAgo } }).lean().exec()
        ]);

        // 2. Получаем ID всех запросов для удаления
        const queryIdsToDelete = oldQueries.map(q => q._id);
        const articleQueryIdsToDelete = oldArticleQueries.map(q => q._id);

        // 3. Удаляем ссылки у пользователей перед удалением запросов
        await UserModel.updateMany(
            { queries: { $in: [...queryIdsToDelete, ...articleQueryIdsToDelete] } },
            { $pull: { queries: { $in: [...queryIdsToDelete, ...articleQueryIdsToDelete] } } }
        );

        // 4. Удаляем сами запросы
        await Promise.all([
            QueryModel.deleteMany({ _id: { $in: queryIdsToDelete } }),
            QueryArticleModel.deleteMany({ _id: { $in: articleQueryIdsToDelete } })
        ]);

    } catch (error) {
        console.error('Ошибка в задаче удаления старых данных:', error);
    } finally {
        taskState.isDataRemovalRunning = false;
    }
});

// Задача проверки пробных периодов (каждые день в 5 часов утра)
// cron.schedule('*/5 * * * *', async () => {
cron.schedule('0 5 * * *', async () => {
    if (taskState.isTrialCheckRunning) {
        console.log('Предыдущая проверка пробных периодов еще выполняется, пропускаем...');
        return;
    }

    try {
        taskState.isTrialCheckRunning = true;
        console.log('Запуск проверки пробных периодов...');
        await checkTrialPeriods();
        console.log('Проверка пробных периодов завершена');
    } catch (error) {
        console.error('Ошибка при проверке пробных периодов:', error);
    } finally {
        taskState.isTrialCheckRunning = false;
    }
});

const startServer = () => {
    // Первоначальная проверка пробных периодов при запуске сервера
    setTimeout(() => {
        checkTrialPeriods().catch(error =>
            console.error('Ошибка при первоначальной проверке пробных периодов:', error)
        );
    }, 10000);

    setTimeout(() => {
        autoQueryService.init().then(() => {
            console.log('AutoQueryService инициализирован');
        }).catch(error =>
            console.error('Ошибка инициализации AutoQueryService:', error)
        );
    }, 5000);

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