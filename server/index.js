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
const {cleanupBrokenLinks} = require("./services/linkCleanupService");
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

// Хранилище для таймеров и состояния задач
const appState = {
    timeouts: [],
    intervals: [],
    tasks: {
        isMainQueryRunning: false,
        isCleanupRunning: false,
        isDataRemovalRunning: false,
        isTrialCheckRunning: false,
        isSubscriptionCheckRunning: false
    }
};

// Функция для безопасного установки таймаута
const safeSetTimeout = (fn, delay) => {
    const id = setTimeout(() => {
        fn();
        // Удаляем таймер из хранилища после выполнения
        appState.timeouts = appState.timeouts.filter(timerId => timerId !== id);
    }, delay);
    appState.timeouts.push(id);
    return id;
};

// Функция для очистки всех таймеров
const clearAllTimeouts = () => {
    appState.timeouts.forEach(clearTimeout);
    appState.timeouts = [];
};

const connectWithRetry = () => {
    mongoose.connect(urlMongo, { serverSelectionTimeoutMS: 5000 })
        .then(() => {
            console.log('Connected to MongoDB');
            startServer();
        })
        .catch((error) => {
            console.error('Ошибка подключения к MongoDB:', error.message);
            // Используем безопасный таймаут
            safeSetTimeout(connectWithRetry, 5000);
        });
};

// Добавляем новую задачу для AutoQueryService (каждые 4 часа)
// cron.schedule('*/5 * * * *', async () => {
    cron.schedule('0 */4 * * *', async () => {
// cron.schedule('0 0,8,12,16,20 * * *', async () => {
    try {
        console.log('Запуск автоматических запросов для всех пользователей...');
        await autoQueryService.processAllUsers();
        console.log('Автоматические запросы завершены');
    } catch (error) {
        console.error('Ошибка в автоматических запросах:', error);
    }
});

// Задача очистки Google Sheets (каждый день в 02:00)
// cron.schedule('*/5 * * * *', async () => {
cron.schedule('0 18 * * *', async () => {
// cron.schedule('45 1 * * *', async () => {
    if (appState.tasks.isCleanupRunning) return;

    try {
        appState.tasks.isCleanupRunning = true;
        console.log('Запуск задачи очистки Google Sheets...');

        const users = await UserModel.find({ spreadsheetId: { $exists: true } }).lean();
        const totalUsers = users.length;
        let processedUsers = 0;

        for (const user of users) {
            try {
                console.log(`Обработка пользователя ${user.email} (${processedUsers + 1}/${totalUsers})`);

                // Добавляем задержку между пользователями
                if (processedUsers > 0) await new Promise(resolve => setTimeout(resolve, 5000));

                await cleanupOldData(user.spreadsheetId, 'Бренд', 7);
                await cleanupOldData(user.spreadsheetId, 'Артикул', 7);
                processedUsers++;
            } catch (error) {
                console.error(`Ошибка очистки данных для пользователя ${user.email}:`, error.message);
                // При ошибке квоты прерываем выполнение
                if (error.message.includes('Quota exceeded')) break;
            }
        }

        console.log(`Задача очистки завершена. Обработано пользователей: ${processedUsers}/${totalUsers}`);
    } catch (error) {
        console.error('Ошибка в задаче очистки Google Sheets:', error);
    } finally {
        appState.tasks.isCleanupRunning = false;
    }
});


// Задача удаления старых данных (каждый день в 03:00)
cron.schedule('0 3 * * *', async () => {
    if (appState.tasks.isDataRemovalRunning) {
        console.log('Предыдущая задача удаления старых данных еще выполняется, пропускаем...');
        return;
    }

    try {
        appState.tasks.isDataRemovalRunning = true;
        console.log('Запуск задачи удаления старых данных...');

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [oldQueries, oldArticleQueries] = await Promise.all([
            QueryModel.find({ createdAt: { $lt: weekAgo } }).lean().exec(),
            QueryArticleModel.find({ createdAt: { $lt: weekAgo } }).lean().exec()
        ]);

        const queryIdsToDelete = oldQueries.map(q => q._id);
        const articleQueryIdsToDelete = oldArticleQueries.map(q => q._id);

        await UserModel.updateMany(
            { queries: { $in: [...queryIdsToDelete, ...articleQueryIdsToDelete] } },
            { $pull: { queries: { $in: [...queryIdsToDelete, ...articleQueryIdsToDelete] } } }
        );

        await Promise.all([
            QueryModel.deleteMany({ _id: { $in: queryIdsToDelete } }),
            QueryArticleModel.deleteMany({ _id: { $in: articleQueryIdsToDelete } })
        ]);

    } catch (error) {
        console.error('Ошибка в задаче удаления старых данных:', error);
    } finally {
        appState.tasks.isDataRemovalRunning = false;
    }
});

// Задача проверки пробных периодов (каждые день в 5 часов утра)
cron.schedule('0 5 * * *', async () => {
    if (appState.tasks.isTrialCheckRunning) {
        console.log('Предыдущая проверка пробных периодов еще выполняется, пропускаем...');
        return;
    }

    try {
        appState.tasks.isTrialCheckRunning = true;
        console.log('Запуск проверки пробных периодов...');
        await checkTrialPeriods();
        console.log('Проверка пробных периодов завершена');
    } catch (error) {
        console.error('Ошибка при проверке пробных периодов:', error);
    } finally {
        appState.tasks.isTrialCheckRunning = false;
    }
});

// Проверка подписок (каждый день в 6 часов утра)
cron.schedule('0 6 * * *', async () => {
    if (appState.tasks.isSubscriptionCheckRunning) return;

    try {
        appState.tasks.isSubscriptionCheckRunning = true;
        console.log('Запуск проверки фактических подписок...');
        await checkSubscriptions();
    } catch (error) {
        console.error('Ошибка при проверке подписок:', error);
    } finally {
        appState.tasks.isSubscriptionCheckRunning = false;
    }
});


// Задача проверки и очистки битых ссылок (каждый день в 7:00 утра)
cron.schedule('0 7 * * *', async () => {
    try {
        console.log('Запуск задачи проверки и очистки битых ссылок...');
        await cleanupBrokenLinks();
        console.log('Задача проверки и очистки битых ссылок завершена');
    } catch (error) {
        console.error('Ошибка в задаче очистки битых ссылок:', error);
    }
});

const startServer = () => {
    // Первоначальная проверка пробных периодов при запуске сервера
    safeSetTimeout(() => {
        checkTrialPeriods()
            .then(() => console.log('Первоначальная проверка пробных периодов завершена'))
            .catch(error => console.error('Ошибка при первоначальной проверке пробных периодов:', error));
    }, 10000);

    app.use('/api/admin', adminRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/otp', otpRoutes);
    app.use('/api/article', protect, queryArticleRoutes);
    app.use('/api/queries', protect, queryRoutes);
    app.use('/api/user', protect, userRoutes);

    const server = app.listen(port, () => {
        console.log(`Сервер работает на http://localhost:${port}`);
    });


// В обработчиках сигналов добавляем очистку AutoQueryService
    process.on('SIGINT', () => {
        console.log('Получен SIGINT. Очистка перед завершением...');
        autoQueryService.cleanup();
        clearAllTimeouts();
        server.close(() => {
            console.log('Сервер остановлен');
            process.exit(0);
        });
    });

    process.on('SIGTERM', () => {
        console.log('Получен SIGTERM. Очистка перед завершением...');
        autoQueryService.cleanup();
        clearAllTimeouts();
        server.close(() => {
            console.log('Сервер остановлен');
            process.exit(0);
        });
    });
};

connectWithRetry();