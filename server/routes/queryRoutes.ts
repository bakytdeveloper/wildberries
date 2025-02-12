import express from 'express';
import { getQueries, createQuery } from '../controllers/queryController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/queries', protect, getQueries);
router.post('/queries', protect, createQuery);

export default router;