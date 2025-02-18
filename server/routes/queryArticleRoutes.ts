import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { createArticleQuery, getArticleQueries, deleteArticleQuery } from '../controllers/queryArticleController';

const router = express.Router();

router.route('/').post(protect, createArticleQuery).get(protect, getArticleQueries);
router.route('/:id').delete(protect, deleteArticleQuery);

export default router;
