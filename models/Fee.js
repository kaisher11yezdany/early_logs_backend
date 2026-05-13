const mongoose = require('mongoose');

// ── Fee Structure ─────────────────────────────────────────────────────────────
// One per class per year — defines the TOTAL annual fee for that class.
// No fixed installments; students pay any amount at any time.
const feeStructureSchema = new mongoose.Schema({
  class:        { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true },
  totalAmount:  { type: Number, required: true, default: 0 },
  description:  { type: String },   // optional note e.g. "Includes tuition + activity"
}, { timestamps: true });

feeStructureSchema.index({ class: 1, academicYear: 1 }, { unique: true });

// ── Individual Payment Entry ───────────────────────────────────────────────────
// Each time a student pays any amount, one entry is pushed here.
const paymentEntrySchema = new mongoose.Schema({
  amount:        { type: Number, required: true },
  paymentDate:   { type: Date, default: Date.now },
  paymentMode:   { type: String, enum: ['cash', 'online', 'upi', 'card', 'bank_transfer'], default: 'cash' },
  receiptNo:     { type: String },
  transactionId: { type: String },
  collectedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks:       { type: String },
}, { timestamps: true });

// ── Student Fee Record ─────────────────────────────────────────────────────────
// One per student per academic year.
// payments[] grows every time the student makes a payment.
const studentFeeSchema = new mongoose.Schema({
  student:      { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  feeStructure: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure' },
  academicYear: { type: String, required: true },
  totalAmount:  { type: Number, required: true, default: 0 }, // copied from structure at init
  payments:     [paymentEntrySchema],
}, { timestamps: true });

studentFeeSchema.index({ student: 1, academicYear: 1 }, { unique: true });

// Computed virtuals
studentFeeSchema.virtual('totalPaid').get(function () {
  return this.payments.reduce((s, p) => s + (p.amount || 0), 0);
});
studentFeeSchema.virtual('balance').get(function () {
  return Math.max(0, this.totalAmount - this.payments.reduce((s, p) => s + (p.amount || 0), 0));
});
studentFeeSchema.virtual('status').get(function () {
  const paid = this.payments.reduce((s, p) => s + (p.amount || 0), 0);
  if (paid <= 0)              return 'pending';
  if (paid >= this.totalAmount) return 'paid';
  return 'partial';
});
studentFeeSchema.set('toJSON', { virtuals: true });

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);
const StudentFee   = mongoose.model('StudentFee',   studentFeeSchema);

module.exports = { FeeStructure, StudentFee };
