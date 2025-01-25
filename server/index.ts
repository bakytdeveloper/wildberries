import express, { Request, Response } from 'express';
import path from 'path';
import { fetchAndParseProducts } from './services/productService';
import mongoose from 'mongoose';
import { QueryModel } from './models/queryModel';
import dotenv from 'dotenv';

dotenv.config();

const cors = require('cors');
const app = express();
const port = process.env.PORT || 5500;

mongoose.connect(process.env.MONGODB_URI!).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

app.use(cors());
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/api/products', async (req: Request, res: Response) => {
    const { query, dest } = req.query;
    console.log(`Received query: ${query}, dest: ${dest}`);

    if (!query || !dest) {
        res.status(400).json({ error: 'Query and dest parameters are required' });
        return;
    }

    try {
        const products = await fetchAndParseProducts(query as string, dest as string);

        // Сохраняем запрос и ответ в базу данных
        const newQuery = new QueryModel({
            query: query,
            dest: dest,
            response: products,
        });
        await newQuery.save();

        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

