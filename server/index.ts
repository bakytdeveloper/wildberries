import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import queryRoutes from './routes/queryRoutes';
import authRoutes from './routes/authRoutes';
import { protect } from './middleware/authMiddleware';
import otpRoutes from "./routes/otpRoutes";
import userRoutes from "./routes/userRoutes";
import queryArticleRoutes from "./routes/queryArticleRoutes";

dotenv.config();

const app = express();
const urlMongo = process.env.MONGODB_URI || 'mongodb+srv://bakytdeveloper:wildberries@wildberries.vuwfs.mongodb.net/Wildberries?retryWrites=true&w=majority';
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
            console.error('Error connecting to MongoDB:', error.message);
            setTimeout(connectWithRetry, 5000);
        });
};

const startServer = () => {
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
