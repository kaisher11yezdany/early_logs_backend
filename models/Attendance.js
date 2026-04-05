const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'leave'], default: 'absent' },
  remarks: { type: String }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  date: { type: Date, required: true },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  records: [attendanceRecordSchema],
  type: { type: String, enum: ['daily', 'period'], default: 'daily' }
}, { timestamps: true });

// Prevent duplicate attendance for same class/date/subject
attendanceSchema.index({ class: 1, date: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
