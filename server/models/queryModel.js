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

const querySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    query: { type: String, required: true },
    dest: { type: String, required: true },
    productTables: [productTableSchema],
    createdAt: { type: Date, default: Date.now },
    city: String,
    brand: String,
    isAutoQuery: { type: Boolean, default: false }
});

// Middleware для удаления ссылки на Query из UserModel
querySchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    const query = this;

    await mongoose.model('User').updateOne(
        { _id: query.userId },
        { $pull: { queries: query._id } }
    );

    next();
});

const QueryModel = mongoose.model('Query', querySchema);

module.exports = { QueryModel };
