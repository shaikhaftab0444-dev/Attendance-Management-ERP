const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  editWindowHours: {
    type: Number,
    default: 24,
  },
  allowTeacherEditHours: {
    type: Number,
    default: 24,
  },
  attendanceThresholdPercent: {
    type: Number,
    default: 75,
  },
  attendanceThreshold: {
    type: Number,
    default: 75,
  },
  institutionName: {
    type: String,
    default: 'AttendEdge Institute of Technology',
  },
  collegeName: {
    type: String,
    default: 'AttendEdge Institute of Technology',
  },
}, {
  timestamps: true,
});

// Keep aliases synchronized
settingSchema.pre('save', function (next) {
  if (this.editWindowHours !== undefined) {
    this.allowTeacherEditHours = this.editWindowHours;
  } else if (this.allowTeacherEditHours !== undefined) {
    this.editWindowHours = this.allowTeacherEditHours;
  }

  if (this.attendanceThresholdPercent !== undefined) {
    this.attendanceThreshold = this.attendanceThresholdPercent;
  } else if (this.attendanceThreshold !== undefined) {
    this.attendanceThresholdPercent = this.attendanceThreshold;
  }

  if (this.institutionName !== undefined) {
    this.collegeName = this.institutionName;
  } else if (this.collegeName !== undefined) {
    this.institutionName = this.collegeName;
  }
  next();
});

module.exports = mongoose.model('Setting', settingSchema);

