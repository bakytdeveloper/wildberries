const express = require('express');
const {deleteQueriesByParams} = require("../controllers/queryController");
const {exportAllToGoogleSheet} = require("../controllers/queryController");
const { getQueries, createQuery, deleteQuery, exportToGoogleSheet, exportToExcel } = require('../controllers/queryController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .get(protect, getQueries)
    .post(protect, createQuery);

router.delete('/:id', protect, deleteQuery);
router.route('/export').post(protect, exportToGoogleSheet); // экспорт данных в таблицу
router.route('/export-all').post(protect, exportAllToGoogleSheet);
router.route('/export-excel').get(protect, exportToExcel);
router.route('/by-params/delete').delete(protect, deleteQueriesByParams);

module.exports = router;
