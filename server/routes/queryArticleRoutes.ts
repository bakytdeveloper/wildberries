import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { createArticleQuery, getArticleQueries, deleteArticleQuery, exportToGoogleSheet } from '../controllers/queryArticleController';

const router = express.Router();

router.route('/').post(protect, createArticleQuery);
router.route('/').get(protect, getArticleQueries);
router.route('/:id').delete(protect, deleteArticleQuery);
router.route('/export').post(protect, exportToGoogleSheet); // Новый маршрут для экспорта данных

export default router;
