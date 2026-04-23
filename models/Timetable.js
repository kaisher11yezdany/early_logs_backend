const mongoose = require('mongoose');

// One document = one class's complete weekly timetable
const timetableSchema = new mongoose.Schema({
  class:        { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true },

  // 6 period time slots (editable per class)
  timeSlots: {
    type: [{
      no:        { type: Number, required: true },
      startTime: { type: String, required: true },
      endTime:   { type: String, required: true },
    }],
    default: [
      { no: 1, startTime: '09:20', endTime: '10:05' },
      { no: 2, startTime: '10:05', endTime: '10:50' },
      { no: 3, startTime: '11:05', endTime: '11:50' },
      { no: 4, startTime: '11:50', endTime: '12:35' },
      { no: 5, startTime: '13:20', endTime: '14:05' },
      { no: 6, startTime: '14:05', endTime: '14:50' },
    ]
  },

  // Break slots that appear between periods (after period 2 → Break, after period 4 → Lunch)
  breaks: {
    type: [{
      after:     { type: Number, required: true }, // insert break column after this period no
      label:     { type: String, default: 'Break' },
      startTime: String,
      endTime:   String,
    }],
    default: [
      { after: 2, label: 'Break', startTime: '10:50', endTime: '11:05' },
      { after: 4, label: 'Lunch', startTime: '12:35', endTime: '13:20' },
    ]
  },

  // Weekly schedule: day name → array of 6 subject/activity strings
  schedule: {
    Monday:    { type: [String], default: ['', '', '', '', '', ''] },
    Tuesday:   { type: [String], default: ['', '', '', '', '', ''] },
    Wednesday: { type: [String], default: ['', '', '', '', '', ''] },
    Thursday:  { type: [String], default: ['', '', '', '', '', ''] },
    Friday:    { type: [String], default: ['', '', '', '', '', ''] },
    Saturday:  { type: [String], default: ['', '', '', '', '', ''] },
  }

}, { timestamps: true });

// Only one timetable per class per academic year
timetableSchema.index({ class: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', timetableSchema);
