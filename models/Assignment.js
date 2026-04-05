const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  submittedAt: { type: Date, default: Date.now },
  fileUrl: { type: String },
  description: { type: String },
  marks: { type: Number },
  feedback: { type: String },
  status: { type: String, enum: ['submitted', 'late', 'evaluated'], default: 'submitted' }
}, { _id: true });

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dueDate: { type: Date, required: true },
  totalMarks: { type: Number, default: 100 },
  attachmentUrl: { type: String },
  submissions: [submissionSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
