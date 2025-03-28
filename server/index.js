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
const { UserModel } = require("./models/userModel");
const { executeUserQueries } = require("./queryService");

dotenv.config();

const app = express();
const urlMongo = process.env.MONGODB_URI;
const port = process.env.PORT || 5505;

app.use(cors());
app.use(express.json());

// Добавляем middleware для обслуживания статических файлов из папки excelFiles
app.use('/excelFiles', express.static(path.join(__dirname, 'excelFiles')));


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

const startServer = () => {
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