const mongoose = require('mongoose');

const addressSchema = {
  street: String,
  city:   String,
  state:  String,
  pincode:String,
};

const teacherSchema = new mongoose.Schema({
  // ── Account link ──────────────────────────────────────────────────────────
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ── Employment ────────────────────────────────────────────────────────────
  employeeId:     { type: String, required: true, unique: true },
  designation:    { type: String },
  department:     { type: String },
  qualification:  { type: String },
  experience:     { type: Number, default: 0 },
  joiningDate:    { type: Date },
  employmentType: { type: String, enum: ['Permanent', 'Contract', 'Part-time', 'Guest'] },

  // ── Identity ──────────────────────────────────────────────────────────────
  dateOfBirth: { type: Date },
  gender:      { type: String, enum: ['male', 'female', 'other'] },
  bloodGroup:  { type: String },
  nationality: { type: String, default: 'Indian' },
  religion:    { type: String },
  aadharNo:    { type: String },

  // ── Addresses ─────────────────────────────────────────────────────────────
  address:          { ...addressSchema },
  permanentAddress: { ...addressSchema },

  // ── Emergency Contact ─────────────────────────────────────────────────────
  emergencyContact: {
    name:     String,
    relation: String,
    phone:    String,
  },

  // ── Meta ──────────────────────────────────────────────────────────────────
  photo:    { type: String, default: '' },
  isActive: { type: Boolean, default: true },

}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);
