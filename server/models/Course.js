const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true, // e.g. "Bachelor of Technology", "Diploma in Engineering"
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true, // e.g. "BTECH", "DIPLOMA", "MBA", "BCA"
  },
  durationYears: {
    type: Number,
    required: true,
    min: 1,
    default: 4, // e.g. 4 for B.Tech, 3 for Diploma, 2 for MBA
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Course', courseSchema);
