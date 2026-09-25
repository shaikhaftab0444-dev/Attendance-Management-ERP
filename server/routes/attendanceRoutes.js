const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { condoneStudent } = require('../controllers/attendanceController');

// POST /api/attendance/condone/:studentId
router.post('/condone/:studentId', auth, roleGuard('admin', 'hod'), condoneStudent);

module.exports = router;
