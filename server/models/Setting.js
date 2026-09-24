const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  editWindowHours: {
    type: Number,
    default: 24,
  },
  attendanceThresholdPercent: {
    type: Number,
    default: 75,
  },
  institutionName: {
    type: String,
    default: 'AttendEdge Institute of Technology',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Setting', settingSchema);
