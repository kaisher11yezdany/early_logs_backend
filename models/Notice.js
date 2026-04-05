const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetRoles: [{
    type: String,
    enum: ['all', 'admin', 'teacher', 'student', 'parent', 'accountant', 'librarian']
  }],
  targetClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  type: { type: String, enum: ['notice', 'event', 'holiday', 'circular', 'alert'], default: 'notice' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  attachmentUrl: { type: String },
  publishDate: { type: Date, default: Date.now },
  expiryDate: { type: Date },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Notice', noticeSchema);
