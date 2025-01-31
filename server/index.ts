import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { QueryModel } from './models/queryModel'; // Убедитесь, что путь правильный
import { fetchAndParseProducts } from './services/productService';

dotenv.config();

const app = express();
const port = process.env.PORT || 5500;
app.use(cors({ origin: '*' }));
app.use(express.json());

const connectWithRetry = () => {
    mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 })
        .then(() => {
            console.log('Подключена база данных MongoDB');
            startServer();
        })
        .catch((error: any) => {
            console.error('Error connecting to MongoDB:', error.message);
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
        res.json(queries);
    } catch (error: any) {
        console.error('Error fetching queries:', (error as Error).message);
        res.status(500).json({ error: 'Failed to fetch queries' });
    }
});

app.post('/api/queries', async (req: Request, res: Response) => {
    const { forms } = req.body;

    if (!forms || !Array.isArray(forms) || forms.length === 0) {
        res.status(400).json({ error: 'Invalid request format' });
        return;
    }

    try {
        const queryTime = new Date().toISOString();
        const productTables = await Promise.all(forms.map(async (form) => {
            const products = await fetchAndParseProducts(form.query, form.dest, form.brand);
            return {
                tableId: form.id,
                products
            };
        }));

        const newQuery = new QueryModel({
            query: forms.map(form => form.query).join('; '),
            dest: forms.map(form => form.dest).join('; '),
            productTables,
            createdAt: new Date(),
            city: forms.map(form => form.city).join('; '), // Сохраняем все города
            brand: forms.map(form => form.brand).join('; ') // Сохраняем все бренды
        });
        await newQuery.save();

        res.json(newQuery);
    } catch (error: any) {
        console.error('Error saving queries:', (error as Error).message);
        res.status(500).json({ error: 'Failed to save queries' });
    }
});

app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!");
});
