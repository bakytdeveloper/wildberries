import express from 'express';
import { getQueries, createQuery } from '../controllers/queryController';

const router = express.Router();

router.get('/queries', getQueries);
router.post('/queries', createQuery);

export default router;
