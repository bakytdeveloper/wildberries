import express, { Request, Response } from 'express';
import path from 'path';
import { fetchAndParseProducts } from './services/productService';
import mongoose from 'mongoose';
import { QueryModel } from './models/queryModel';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 5500;

mongoose.connect(process.env.MONGODB_URI!)
    .then(() => {
        console.log('Подключено к MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error.message);
    });

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/api/queries', async (req: Request, res: Response) => {
    try {
        const queries = await QueryModel.find().sort({ createdAt: -1 });
        console.log('queries:', queries);
        res.json(queries);
    } catch (error) {
        console.error('Error fetching queries:', Error);
        res.status(500).json({ error: 'Failed to fetch queries' });
    }
});

app.get('/api/products', async (req: Request, res: Response) => {
    const { query, dest } = req.query;
    console.log(`Полученный запрос: ${query}, dest: ${dest}`);

    if (!query || !dest) {
        res.status(400).json({ error: 'Query and dest parameters are required' });
        return;
    }

    try {
        const products = await fetchAndParseProducts(query as string, dest as string);

        const newQuery = new QueryModel({
            query: query,
            dest: dest,
            response: products,
        });
        await newQuery.save();

        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', Error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Статические файлы обслуживаются после всех маршрутов API
app.use(express.static(path.join(__dirname, '../../public')));

app.listen(port, () => {
    console.log(`Сервер запущен на: http://localhost:${port}`);
});
