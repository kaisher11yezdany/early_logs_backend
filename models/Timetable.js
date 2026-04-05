const mongoose = require('mongoose');

const periodSchema = new mongoose.Schema({
  periodNo: { type: Number, required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startTime: { type: String, required: true }, // "09:00"
  endTime: { type: String, required: true },   // "09:45"
  isBreak: { type: Boolean, default: false },
  breakLabel: { type: String }
}, { _id: false });

const timetableSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true },
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true
  },
  periods: [periodSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

timetableSchema.index({ class: 1, day: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', timetableSchema);
