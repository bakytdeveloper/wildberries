const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { createArticleQuery, getArticleQueries, deleteArticleQuery, exportToGoogleSheet } = require('../controllers/queryArticleController');

const router = express.Router();

router.route('/')
    .post(protect, createArticleQuery)
    .get(protect, getArticleQueries);

router.route('/:id').delete(protect, deleteArticleQuery);
router.route('/export').post(protect, exportToGoogleSheet); // для экспорта данных

module.exports = router;
