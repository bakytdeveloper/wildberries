const { UserModel } = require('../models/userModel');

const getUserProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await UserModel.findById(userId).populate('queries');
        res.json(user);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Не удалось получить профиль пользователя.' });
    }
};

module.exports = { getUserProfile };
