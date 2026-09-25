const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['teacher', 'hod', 'admin'],
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
  },
  year: {
    type: Number,
    min: 1,
    max: 8,
    default: null,
  },
  teachingYears: {
    type: [
      {
        type: Number,
        min: 1,
        max: 4,
      },
    ],
    default: undefined,
  },
  assignedBatches: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
    },
  ],
  batches: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
    },
  ],
  employeeId: {
    type: String,
    trim: true,
    default: '',
  },
  phone: {
    type: String,
    trim: true,
    default: '',
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

module.exports = mongoose.model('User', userSchema);

