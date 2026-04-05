const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },   // e.g., "Class 10"
  section: { type: String, required: true, trim: true }, // e.g., "A"
  academicYear: { type: String, required: true },        // e.g., "2024-25"
  classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  strength: { type: Number, default: 0 },
  roomNumber: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

classSchema.virtual('fullName').get(function () {
  return `${this.name} - ${this.section}`;
});

module.exports = mongoose.model('Class', classSchema);
