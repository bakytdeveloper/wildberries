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

app.use(cors({ origin: '*' }));
app.use(express.json());

const connectWithRetry = () => {
    mongoose.connect(process.env.MONGODB_URI!, {
        serverSelectionTimeoutMS: 5000,
    })
        .then(() => {
            console.log('Подключена база данных MongoDB');
            startServer();
        })
        .catch((error: any) => {
            console.error('Error connecting to MongoDB:', error.message, error);
            if (error.cause && error.cause.errors) {
                console.error('Error details:', error.cause.errors);
            }
            console.log('Retrying MongoDB connection in 5 seconds...');
            setTimeout(connectWithRetry, 5000); // Повторная попытка через 5 секунд
        });
};

const startServer = () => {
    app.listen(port, () => {
        console.log(`Сервер работает на http://localhost:${port}`);
    });
};

connectWithRetry();

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

        if (!products || products.length === 0) {
            res.status(404).json({ error: 'No products found' });
            return;
        }

        const now = new Date();
        // Московское время (UTC+3)
        now.setHours(now.getUTCHours() + 3);
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

app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!");
});
