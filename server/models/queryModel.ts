import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    id: { type: String, required: true }, // Артикул товара
    imageUrl: String,
    page: Number,
    position: Number,
    brand: String,
    name: String,
    log: {
        position: Number
    }
});

const productTableSchema = new mongoose.Schema({
    tableId: String,
    products: [productSchema]
});

const querySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Добавляем ссылку на пользователя
    query: { type: String, required: true },
    dest: { type: String, required: true },
    productTables: [productTableSchema],
    createdAt: { type: Date, default: Date.now, expires: '1d' },
    city: String,
    brand: String
});

const QueryModel = mongoose.model('Query', querySchema);

export { QueryModel };
