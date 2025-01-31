import { Schema, model, Document } from 'mongoose';
import {Product, ProductTable} from './product';

export interface QueryDocument extends Document {
    query: string;
    dest: string;
    productTables: ProductTable[]; // Поле для таблиц с товарами
    createdAt: Date;
    city: string;
    brand: string;
}

// Новая схема для таблиц с товарами
const productSchema = new Schema<Product>({
    brand: { type: String, required: true },
    name: { type: String, required: true },
    position: { type: Schema.Types.Mixed, required: true },
    page: { type: Schema.Types.Mixed, required: true },
    queryTime: { type: String, required: true },
    imageUrl: { type: String, required: true },
    log: { type: Schema.Types.Mixed }
});

const productTableSchema = new Schema({
    tableId: { type: String, required: true },
    products: { type: [productSchema], required: true }
});

const querySchema = new Schema<QueryDocument>({
    query: { type: String, required: true },
    dest: { type: String, required: true },
    productTables: { type: [productTableSchema], required: true }, // Поле для таблиц с товарами
    createdAt: { type: Date, default: Date.now },
    city: { type: String, required: true },
    brand: { type: String, required: true }
});

export const QueryModel = model<QueryDocument>('Query', querySchema);
