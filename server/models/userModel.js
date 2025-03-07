const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    queries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Query' }],
    spreadsheetId: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.model('User', userSchema);

module.exports = { UserModel };
