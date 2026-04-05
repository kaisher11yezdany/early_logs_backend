const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['theory', 'practical', 'both'], default: 'theory' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
