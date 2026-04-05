const express = require('express');
const router = express.Router();
const { FeeStructure, Payment } = require('../models/Fee');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// --- Fee Structure ---
router.get('/structure', protect, async (req, res) => {
  try {
    const structures = await FeeStructure.find().populate('class', 'name section');
    res.json({ success: true, structures });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/structure', protect, authorize('admin', 'accountant'), async (req, res) => {
  try {
    const structure = await FeeStructure.create(req.body);
    res.status(201).json({ success: true, structure });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Payments ---
router.get('/payments', protect, authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { studentId, status, month } = req.query;
    let query = {};
    if (studentId) query.student = studentId;
    if (status) query.status = status;
    if (month) query.month = { $regex: month, $options: 'i' };
    const payments = await Payment.find(query)
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payments', protect, authorize('admin', 'accountant'), async (req, res) => {
  try {
    const receiptNo = `RCP-${Date.now()}`;
    const payment = await Payment.create({ ...req.body, receiptNo, collectedBy: req.user._id });
    res.status(201).json({ success: true, message: 'Payment recorded', payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET student fee summary
router.get('/student/:studentId', protect, async (req, res) => {
  try {
    const payments = await Payment.find({ student: req.params.studentId }).sort({ createdAt: -1 });
    const summary = {
      totalPaid: payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.paidAmount, 0),
      totalPending: payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.dueAmount, 0),
      totalOverdue: payments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.dueAmount, 0),
    };
    res.json({ success: true, payments, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET my fees (for student/parent)
router.get('/my/fees', protect, authorize('student', 'parent'), async (req, res) => {
  try {
    let studentIds = [];
    if (req.user.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      if (student) studentIds = [student._id];
    } else {
      studentIds = req.user.children || [];
    }
    const payments = await Payment.find({ student: { $in: studentIds } })
      .populate('student', 'admissionNo')
      .sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET financial summary
router.get('/summary/stats', protect, authorize('admin', 'accountant'), async (req, res) => {
  try {
    const [totalPaid, totalPending, totalOverdue] = await Promise.all([
      Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]),
      Payment.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, total: { $sum: '$dueAmount' } } }]),
      Payment.aggregate([{ $match: { status: 'overdue' } }, { $group: { _id: null, total: { $sum: '$dueAmount' } } }])
    ]);
    res.json({
      success: true,
      stats: {
        totalPaid: totalPaid[0]?.total || 0,
        totalPending: totalPending[0]?.total || 0,
        totalOverdue: totalOverdue[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
