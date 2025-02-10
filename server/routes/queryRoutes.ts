import express from 'express';
import { getQueries, createQuery } from '../controllers/queryController';

const router = express.Router();

router.get('/api/queries', getQueries);
router.post('/api/queries', createQuery);

export default router;
