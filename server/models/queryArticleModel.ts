import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    id: { type: String, required: true },
    imageUrl: String,
    page: Number,
    position: Number,
    brand: String,
    name: String,
    log: { position: Number }
});

const productTableSchema = new mongoose.Schema({
    tableId: String,
    products: [productSchema]
});

const queryArticleSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    query: { type: String, required: true },
    article: { type: String, required: true },
    productTables: [productTableSchema],
    createdAt: { type: Date, default: Date.now, expires: '1d' },
    city: String
});

const QueryArticleModel = mongoose.model('QueryArticle', queryArticleSchema);

export { QueryArticleModel };
