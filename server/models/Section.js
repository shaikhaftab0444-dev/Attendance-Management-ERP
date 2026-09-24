const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true, // e.g. "Section A", "CSE-4A"
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  year: {
    type: Number,
    required: true,
    enum: [1, 2, 3, 4],
    default: 1,
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true,
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Section', sectionSchema);
