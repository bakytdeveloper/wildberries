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

mongoose.connect(process.env.MONGODB_URI!, {
    serverSelectionTimeoutMS: 5000, // 5 seconds timeout
})
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error: any) => {
        console.error('Error connecting to MongoDB:', error.message, error);
    });

app.use(cors({ origin: '*' }));
app.use(express.json());

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
    const { query, dest } = req.query;
    console.log(`Received query: ${query}, dest: ${dest}`);

    if (!query || !dest) {
        res.status(400).json({ error: 'Query and dest parameters are required' });
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
            queryTime: queryTime
        });
        await newQuery.save();

        res.json(products);
    } catch (error: any) {
        console.error('Error fetching products:', error.message);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Статические файлы обслуживаются после всех маршрутов API
app.use(express.static(path.join(__dirname, '../../public')));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Обработка маршрутов, которые не были найдены
app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!");
});
