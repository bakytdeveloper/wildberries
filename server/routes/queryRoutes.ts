import express from 'express';
import {getQueries, createQuery, deleteQuery} from '../controllers/queryController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/queries', protect, getQueries);
router.post('/queries', protect, createQuery);
router.delete('/queries/:id', protect, deleteQuery);


export default router;