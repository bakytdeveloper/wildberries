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

const getCurrentUser = async (req, res) => {
    try {

        const userId = req.userId;

        if (userId === 'admin') {
            return;
        }
        const user = await UserModel.findById(userId)
            .select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Не удалось получить информацию о пользователе' });
    }
};


module.exports = { getUserProfile, getCurrentUser };