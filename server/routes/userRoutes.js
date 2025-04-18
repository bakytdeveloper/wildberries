const express = require('express');
const authController = require("../controllers/authController");
const {getCurrentUser} = require("../controllers/userController");
const {forGoogleSheets} = require("../middleware/authMiddleware");
const { getUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profile', protect, getUserProfile);
router.get('/spreadsheet', forGoogleSheets, authController.getUserSpreadsheet);
router.get('/me', protect, getCurrentUser);

module.exports = router;
