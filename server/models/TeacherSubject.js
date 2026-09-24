const mongoose = require('mongoose');

const teacherSubjectSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true,
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true,
  },
}, {
  timestamps: true,
});

teacherSubjectSchema.index({ teacher: 1, subject: 1, section: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('TeacherSubject', teacherSubjectSchema);
