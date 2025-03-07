import express from 'express';
import {getQueries, createQuery, deleteQuery, exportToGoogleSheet} from '../controllers/queryController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, getQueries);
router.post('/', protect, createQuery);
router.delete('/:id', protect, deleteQuery);
router.route('/export').post(protect, exportToGoogleSheet); // Новый маршрут для экспорта данных


export default router;