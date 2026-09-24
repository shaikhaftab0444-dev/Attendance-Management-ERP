const mongoose = require('mongoose');

const periodTemplateSchema = new mongoose.Schema(
  {
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: [true, 'Section is required'],
    },
    periodNumber: {
      type: Number,
      required: [true, 'Period number is required'],
      min: [1, 'Period number must be at least 1'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index on (section, periodNumber)
periodTemplateSchema.index({ section: 1, periodNumber: 1 }, { unique: true });

module.exports = mongoose.model('PeriodTemplate', periodTemplateSchema);
