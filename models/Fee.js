const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true },
  components: [{
    name: { type: String, required: true }, // Tuition, Transport, etc.
    amount: { type: Number, required: true },
    frequency: { type: String, enum: ['monthly', 'quarterly', 'yearly', 'one-time'], default: 'monthly' }
  }],
  totalAmount: { type: Number }
}, { timestamps: true });

const paymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  feeStructure: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure' },
  month: { type: String }, // e.g., "April 2024"
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number },
  dueDate: { type: Date },
  paymentDate: { type: Date },
  paymentMode: { type: String, enum: ['cash', 'online', 'upi', 'card', 'bank_transfer'], default: 'cash' },
  transactionId: { type: String },
  receiptNo: { type: String },
  status: { type: String, enum: ['paid', 'pending', 'partial', 'overdue'], default: 'pending' },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: { type: String }
}, { timestamps: true });

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);
const Payment = mongoose.model('Payment', paymentSchema);

module.exports = { FeeStructure, Payment };
