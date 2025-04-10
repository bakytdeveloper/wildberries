const express = require('express');
const authController = require("../controllers/authController");
const {forGoogleSheets} = require("../middleware/authMiddleware");
const { getUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profile', protect, getUserProfile);
router.get('/spreadsheet', forGoogleSheets, authController.getUserSpreadsheet);

module.exports = router;
