const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  marksObtained: { type: Number },
  grade: { type: String },
  remarks: { type: String },
  isAbsent: { type: Boolean, default: false }
}, { _id: false });

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['unit_test', 'midterm', 'final', 'online', 'assignment'], default: 'unit_test' },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  examDate: { type: Date, required: true },
  startTime: { type: String },
  duration: { type: Number }, // in minutes
  totalMarks: { type: Number, required: true },
  passingMarks: { type: Number },
  venue: { type: String },
  marks: [markSchema],
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);
