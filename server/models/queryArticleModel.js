const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    id: { type: String, required: true },
    imageUrl: String,
    page: Number,
    position: Number,
    query: String,
    city: String,
    dest: String,
    brand: String,
    queryTime: String,
    name: String,
    log: {
        promoPosition: { type: Number, required: false },
        position: { type: Number, required: false }
    }
});

const productTableSchema = new mongoose.Schema({
    tableId: String,
    products: [productSchema]
});

const queryArticleSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    query: { type: String, required: true },
    article: { type: String, required: true },
    dest: { type: String, required: true },
    productTables: [productTableSchema],
    createdAt: { type: Date, default: Date.now, expires: 604800 },
    city: String,
    isAutoQuery: { type: Boolean, default: false }
});

// Middleware для удаления ссылки на QueryArticle из UserModel
queryArticleSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    const queryArticle = this;

    await mongoose.model('User').updateOne(
        { _id: queryArticle.userId },
        { $pull: { queries: queryArticle._id } }
    );

    next();
});

const QueryArticleModel = mongoose.model('QueryArticle', queryArticleSchema);

module.exports = { QueryArticleModel };
