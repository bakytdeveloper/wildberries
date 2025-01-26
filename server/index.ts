import express, { Request, Response } from 'express';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { QueryModel } from './models/queryModel';
import { fetchAndParseProducts } from './services/productService';

dotenv.config();

const app = express();
const port = process.env.PORT || 5500;

const connectWithRetry = () => {
    mongoose.connect(process.env.MONGODB_URI!, {
        // Таймаут выбора сервера: клиент MongoDB ждет 5 секунд,
        // чтобы найти подходящий сервер в кластере.
        serverSelectionTimeoutMS: 5000,

    })
        .then(() => {
            console.log('Connected to MongoDB');
            startServer();
        })
        .catch((error: any) => {
            console.error('Error connecting to MongoDB:', error.message, error);
            if (error.cause && error.cause.errors) {
                console.error('Error details:', error.cause.errors);
            }
            console.log('Retrying MongoDB connection in 5 seconds...');
            setTimeout(connectWithRetry, 5000);
        });
};

const startServer = () => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
};

connectWithRetry();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Статические файлы обслуживаются после всех маршрутов API
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/api/queries', async (req: Request, res: Response) => {
    try {
        const queries = await QueryModel.find().sort({ createdAt: -1 });
        console.log('queries:', queries);
        res.json(queries);
    } catch (error: any) {
        console.error('Error fetching queries:', error.message);
        res.status(500).json({ error: 'Failed to fetch queries' });
    }
});

app.get('/api/products', async (req: Request, res: Response) => {
    const { query, dest, city } = req.query;
    console.log(`Received query: ${query}, dest: ${dest}, city: ${city}`);

    if (!query || !dest || !city) {
        res.status(400).json({ error: 'Query, dest, and city parameters are required' });
        return;
    }

    try {
        const products = await fetchAndParseProducts(query as string, dest as string);

        const now = new Date();
        now.setHours(now.getUTCHours() + 3); // Московское время (UTC+3)
        const queryTime = now.toISOString();

        const newQuery = new QueryModel({
            query: query,
            dest: dest,
            response: products,
            createdAt: new Date(),
            city: city as string,
            queryTime: queryTime
        });
        await newQuery.save();

        res.json(products);
    } catch (error: any) {
        console.error('Error fetching products:', error.message);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Обработка маршрутов, которые не были найдены
app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!");
});
