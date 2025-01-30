import express, { Request, Response } from 'express';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { QueryModel } from './models/queryModel';
import { fetchAndParseProducts } from './services/productService';
import { Product } from './models/product'; // Импортируем интерфейс Product

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
        // console.log('queries:', queries);
        res.json(queries);
    } catch (error: any) {
        console.error('Error fetching queries:', error.message);
        res.status(500).json({ error: 'Failed to fetch queries' });
    }
});

app.get('/api/products', async (req: Request, res: Response) => {
    const { query, dest, city, brand: selectedBrand } = req.query;
    console.log(`Received query: ${query}, dest: ${dest}, city: ${city}, brand: ${selectedBrand}`);

    if (!query || !dest || !city || !selectedBrand) {
        res.status(400).json({ error: 'Query, dest, city, and brand parameters are required' });
        return;
    }

    try {
        const products: Product[] = await fetchAndParseProducts(query as string, dest as string, selectedBrand as string);

        if (!products || products.length === 0) {
            res.status(200).json({ message: 'No products found' });
            return;
        }

        const updatedProducts = products.map(product => {
            if (product.log && product.log.position) {
                const position = product.log.position.toString();
                product.page = position[0];
                product.position = position.slice(1);
            }
            return product;
        });

        const now = new Date();
        now.setHours(now.getUTCHours() + 3);
        const queryTime = now.toISOString();

        const newQuery = new QueryModel({
            query: query,
            dest: dest,
            response: updatedProducts,
            createdAt: new Date(),
            city: city as string,
            brand: selectedBrand as string, // Сохранение бренда
            queryTime: queryTime
        });
        await newQuery.save();

        res.json(updatedProducts);
    } catch (error: any) {
        console.error('Error fetching products:', error.message);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.use((req, res, next) => {
    res.status(404).send("Sorry can't find that!");
});
