// userController.ts
import { Request, Response } from 'express';
import { UserModel } from '../models/userModel';

export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const user = await UserModel.findById(userId).populate('queries');
        res.json(user);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
};