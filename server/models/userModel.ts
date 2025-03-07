import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    queries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Query' }],
    spreadsheetId: { type: String }, // иидентификатора Google Таблицы
    createdAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.model('User', userSchema);
export { UserModel };
