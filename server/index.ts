// @ts-ignore
import express, { Request, Response } from 'express';
// @ts-ignore
import path from 'path';
import { fetchAndParseProducts } from './services/productService';
const cors = require('cors');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());  // Используем CORS
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/api/products', async (req: Request, res: Response) => {
    const { query, dest } = req.query;
    console.log(`Received query: ${query}, dest: ${dest}`);

    try {
        const products = await fetchAndParseProducts(query as string, dest as string);
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
