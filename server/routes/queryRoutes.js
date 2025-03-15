const express = require('express');
const { getQueries, createQuery, deleteQuery, exportToGoogleSheet } = require('../controllers/queryController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .get(protect, getQueries)
    .post(protect, createQuery);
router.delete('/:id', protect, deleteQuery);
router.route('/export').post(protect, exportToGoogleSheet); // экспорт данных в таблицу

module.exports = router;
