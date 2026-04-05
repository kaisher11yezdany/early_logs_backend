const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student', 'parent', 'accountant', 'librarian'],
    default: 'student'
  },
  phone: { type: String },
  avatar: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  // For teacher: assigned classes/subjects
  assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  assignedSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  // For student/parent: link
  studentProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  // For parent: children
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  lastLogin: { type: Date },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
