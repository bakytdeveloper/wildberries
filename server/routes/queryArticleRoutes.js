const express = require('express');
const {deleteArticleQueriesByParams} = require("../controllers/queryArticleController");
const {exportAllToGoogleSheet} = require("../controllers/queryArticleController");
const { protect } = require('../middleware/authMiddleware');
const { createArticleQuery, getArticleQueries, deleteArticleQuery, exportToGoogleSheet, exportToExcel } = require('../controllers/queryArticleController');

const router = express.Router();

router.route('/')
    .post(protect, createArticleQuery)
    .get(protect, getArticleQueries);

router.route('/:id').delete(protect, deleteArticleQuery);
router.route('/export').post(protect, exportToGoogleSheet); // для экспорта данных
router.route('/export-all').post(protect, exportAllToGoogleSheet);
router.route('/export-excel').get(protect, exportToExcel);
router.route('/by-params/delete').delete(protect, deleteArticleQueriesByParams);

module.exports = router;
