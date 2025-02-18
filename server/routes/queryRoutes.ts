import express from 'express';
import {getQueries, createQuery, deleteQuery} from '../controllers/queryController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, getQueries);
router.post('/', protect, createQuery);
router.delete('/:id', protect, deleteQuery);


export default router;