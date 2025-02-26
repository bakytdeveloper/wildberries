import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    id: { type: String, required: true },
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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    query: { type: String, required: true },
    dest: { type: String, required: true },
    productTables: [productTableSchema],
    createdAt: { type: Date, default: Date.now },
    city: String,
    brand: String
});

// Middleware для удаления ссылки на Query из UserModel
querySchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    const query = this;

    // Удаляем ссылку на этот Query из поля queries в UserModel
    await mongoose.model('User').updateOne(
        { _id: query.userId },
        { $pull: { queries: query._id } }
    );

    next();
});

const QueryModel = mongoose.model('Query', querySchema);

export { QueryModel };