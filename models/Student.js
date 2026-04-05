const mongoose = require('mongoose');

const addressSchema = {
  street: String,
  city: String,
  state: String,
  pincode: String
};

const studentSchema = new mongoose.Schema({
  // ── Account link ──────────────────────────────────────────────────────────
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ── Admission Details ─────────────────────────────────────────────────────
  admissionNo:   { type: String, required: true, unique: true },
  rollNo:        { type: String },
  academicYear:  { type: String, required: true },
  admissionDate: { type: Date, default: Date.now },
  admissionTime: { type: String },
  admissionDay:  { type: String },

  // ── Class ─────────────────────────────────────────────────────────────────
  class:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  section: { type: String },

  // ── Student Identity ──────────────────────────────────────────────────────
  dateOfBirth:  { type: Date },
  gender:       { type: String, enum: ['male', 'female', 'other'] },
  caste:        { type: String },
  category:     { type: String, enum: ['General', 'OBC', 'SC', 'ST', 'Other', ''] },
  nationality:  { type: String, default: 'Indian' },
  religion:     { type: String },
  placeOfBirth: { type: String },
  aadharNo:     { type: String },
  language:     { type: String },
  bloodGroup:   { type: String },

  // ── Addresses ─────────────────────────────────────────────────────────────
  address:          { ...addressSchema },   // current address
  permanentAddress: { ...addressSchema },   // permanent address

  // ── Parent Information ────────────────────────────────────────────────────
  parentInfo: {
    father: {
      name:          String,
      qualification: String,
      occupation:    String,
      aadharNo:      String,
      email:         String,
      phone:         String
    },
    mother: {
      name:          String,
      qualification: String,
      occupation:    String,
      aadharNo:      String,
      email:         String,
      phone:         String
    },
    guardianSignature: String
  },
  parentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Documents Submitted ───────────────────────────────────────────────────
  documents: {
    aadharCard:           { type: Boolean, default: false },
    tc:                   { type: Boolean, default: false },
    birthCertificate:     { type: Boolean, default: false },
    bplCard:              { type: Boolean, default: false },
    casteIncomeCert:      { type: Boolean, default: false },
    conductCharacterCert: { type: Boolean, default: false }
  },

  // ── Previous School ───────────────────────────────────────────────────────
  previousSchool: {
    name:               String,
    standardLastStudied:String,
    transferNoDate:     String,
    previousProgress:   String,
    dateOfLeaving:      Date,
    tcNoDate:           String,
    penNo:              String,
    satsNo:             String,
    apparId:            String,
    udiseCode:          String
  },

  // ── Transport ─────────────────────────────────────────────────────────────
  transport: {
    enrolled: { type: Boolean, default: false },
    route:    String,
    busNo:    String
  },

  // ── Office Use Only ───────────────────────────────────────────────────────
  officeUse: {
    signOfEnrolled:    String,
    dateOfEnrolment:   Date,
    timeOfEnrolment:   String,
    dayOfEnrolment:    String,
    documentSubmitted: String
  },

  // ── Meta ──────────────────────────────────────────────────────────────────
  isActive: { type: Boolean, default: true },
  photo:    { type: String, default: '' }

}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
