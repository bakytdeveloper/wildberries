const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    queries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Query' }],
    spreadsheetId: { type: String },
    excelFileId: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date },
    unblockedAt: { type: Date },
    subscription: {
        amount: { type: Number, default: 0 },
        subscriptionEndDate: { type: Date },
        lastPaymentDate: { type: Date },
        isTrial: { type: Boolean, default: true }, // Добавляем флаг пробного периода
        trialEndDate: { type: Date }, // Дата окончания пробного периода
        trialWarningSent: { type: Boolean, default: false }, // Добавляем поле для отслеживания отправки предупреждения
        subscriptionWarningSent: { type: Boolean, default: false } // Для предупреждений о подписке
    }
});

const UserModel = mongoose.model('User', userSchema);

module.exports = { UserModel };