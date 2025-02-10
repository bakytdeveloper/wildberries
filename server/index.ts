import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import queryRoutes from './routes/queryRoutes';

dotenv.config();

const app = express();
// const urlMongo = 'mongodb+srv://bakytdeveloper:wildberries@wildberries.vuwfs.mongodb.net/Wildberries?retryWrites=true&w=majority';
const port = process.env.PORT || 5505;
app.use(cors({ origin: '*' }));
app.use(express.json());

const connectWithRetry = () => {
    mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 })
    // mongoose.connect(process.env.MONGODB_URI! || urlMongo, { serverSelectionTimeoutMS: 5000 })
        .then(() => {
            console.log('Подключена база данных MongoDB');
            startServer();
        })
        .catch((error) => {
            console.error('Error connecting to MongoDB:', error.message);
            setTimeout(connectWithRetry, 5000);
        });
};

const startServer = () => {
    app.use('/', queryRoutes); // Обязательно укажи префикс маршрута
    app.listen(port, () => {
        console.log(`Сервер работает на http://localhost:${port}`);
    });
};

connectWithRetry();
