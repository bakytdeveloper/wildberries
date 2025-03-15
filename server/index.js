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

dotenv.config();

const app = express();
const urlMongo = process.env.MONGODB_URI;
const port = process.env.PORT || 5505;

app.use(cors());
app.use(express.json());

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
