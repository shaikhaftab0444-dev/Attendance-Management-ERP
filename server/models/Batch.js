const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  startYear: {
    type: Number,
    required: true,
    min: 1990,
    max: 2100,
  },
  endYear: {
    type: Number,
    required: true,
    min: 1990,
    max: 2100,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure unique batch name within the same Course
batchSchema.index({ course: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Batch', batchSchema);
