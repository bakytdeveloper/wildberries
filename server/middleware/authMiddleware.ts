import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'yourSecretKey';

interface JwtPayload {
    userId: string;
}

export const protect = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        (req as any).userId = decoded.userId;  // Use "as any" as a workaround
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
