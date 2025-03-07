const express = require('express');
const { getQueries, createQuery, deleteQuery, exportToGoogleSheet } = require('../controllers/queryController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .get(protect, getQueries)
    .post(protect, createQuery);
router.delete('/:id', protect, deleteQuery);
router.route('/export')
    .post(protect, exportToGoogleSheet); // Новый маршрут для экспорта данных

module.exports = router;
