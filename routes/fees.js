const express = require('express');
const router  = express.Router();
const { FeeStructure, StudentFee } = require('../models/Fee');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// ── Fee Structure (per class) ─────────────────────────────────────────────────

// GET /fees/structure?year=2025-2026
router.get('/structure', protect, async (req, res) => {
  try {
    const query = req.query.year ? { academicYear: req.query.year } : {};
    const structures = await FeeStructure.find(query)
      .populate('class', 'name section')
      .sort({ createdAt: 1 });
    res.json({ success: true, structures });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /fees/structure/:classId  (upsert)
router.put('/structure/:classId', protect, authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { academicYear, totalAmount, description } = req.body;
    const structure = await FeeStructure.findOneAndUpdate(
      { class: req.params.classId, academicYear },
      { class: req.params.classId, academicYear, totalAmount, description },
      { new: true, upsert: true, runValidators: false }
    ).populate('class', 'name section');
    res.json({ success: true, structure });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Student Fees ──────────────────────────────────────────────────────────────

// POST /fees/students/initialize  — must be before /:studentId routes
// Creates a StudentFee record for every student in a class (skips existing ones)
router.post('/students/initialize', protect, authorize('admin'), async (req, res) => {
  try {
    const { classId, academicYear } = req.body;
    const structure = await FeeStructure.findOne({ class: classId, academicYear });
    if (!structure)
      return res.status(400).json({ success: false, message: 'Set the total fee for this class first.' });

    const students = await Student.find({ class: classId, academicYear, isActive: true });
    let created = 0, skipped = 0;
    for (const s of students) {
      const exists = await StudentFee.findOne({ student: s._id, academicYear });
      if (exists) { skipped++; continue; }
      await StudentFee.create({
        student: s._id, feeStructure: structure._id,
        academicYear, totalAmount: structure.totalAmount, payments: [],
      });
      created++;
    }
    res.json({ success: true, message: `Done — ${created} initialized, ${skipped} already existed` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /fees/students?classId=&academicYear=&search=
router.get('/students', protect, authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { classId, academicYear = '2025-2026', search } = req.query;
    let studentQuery = { isActive: true };
    if (classId)     studentQuery.class = classId;
    if (academicYear) studentQuery.academicYear = academicYear;

    let students = await Student.find(studentQuery)
      .populate('user', 'name email phone')
      .populate('class', 'name section')
      .sort({ admissionNo: 1 });

    if (search) {
      const q = search.toLowerCase();
      students = students.filter(s =>
        s.user?.name?.toLowerCase().includes(q) ||
        s.admissionNo?.toLowerCase().includes(q)
      );
    }

    const ids = students.map(s => s._id);
    const fees = await StudentFee.find({ student: { $in: ids }, academicYear });
    const feeMap = Object.fromEntries(fees.map(f => [f.student.toString(), f]));

    const data = students.map(s => ({ student: s, fee: feeMap[s._id.toString()] || null }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /fees/student/:studentId?academicYear=
router.get('/student/:studentId', protect, async (req, res) => {
  try {
    const { academicYear = '2025-2026' } = req.query;
    const feeRecord = await StudentFee
      .findOne({ student: req.params.studentId, academicYear })
      .populate({ path: 'student', populate: { path: 'user', select: 'name email phone' } })
      .populate({ path: 'payments.collectedBy', select: 'name' });
    res.json({ success: true, feeRecord: feeRecord || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /fees/students/:studentId/payment  — add one payment entry (any amount)
router.post('/students/:studentId/payment', protect, authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { amount, paymentMode = 'cash', transactionId, remarks, paymentDate, academicYear = '2025-2026' } = req.body;

    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Enter a valid amount' });

    const feeRecord = await StudentFee.findOne({ student: req.params.studentId, academicYear });
    if (!feeRecord)
      return res.status(404).json({ success: false, message: 'Fee record not found. Initialize fees first.' });

    const totalPaid = feeRecord.payments.reduce((s, p) => s + p.amount, 0);
    if (totalPaid + Number(amount) > feeRecord.totalAmount)
      return res.status(400).json({ success: false, message: `Payment exceeds remaining balance of ₹${feeRecord.totalAmount - totalPaid}` });

    const receiptNo = `RCP-${Date.now()}`;
    feeRecord.payments.push({
      amount: Number(amount),
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMode,
      receiptNo,
      transactionId,
      collectedBy: req.user._id,
      remarks,
    });
    await feeRecord.save();

    res.json({ success: true, message: 'Payment recorded', feeRecord, receiptNo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /fees/students/:studentId/payment/:paymentId  — remove a mis-entered payment
router.delete('/students/:studentId/payment/:paymentId', protect, authorize('admin'), async (req, res) => {
  try {
    const { academicYear = '2025-2026' } = req.query;
    const feeRecord = await StudentFee.findOne({ student: req.params.studentId, academicYear });
    if (!feeRecord) return res.status(404).json({ success: false, message: 'Fee record not found' });

    feeRecord.payments = feeRecord.payments.filter(p => p._id.toString() !== req.params.paymentId);
    await feeRecord.save();
    res.json({ success: true, message: 'Payment removed', feeRecord });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /fees/my/fees  — student / parent own view
router.get('/my/fees', protect, authorize('student', 'parent'), async (req, res) => {
  try {
    let studentIds = [];
    if (req.user.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      if (student) studentIds = [student._id];
    } else {
      studentIds = req.user.children || [];
    }
    const feeRecords = await StudentFee.find({ student: { $in: studentIds } })
      .populate({ path: 'student', populate: [
        { path: 'user',  select: 'name' },
        { path: 'class', select: 'name section' },
      ]})
      .sort({ academicYear: -1 });
    res.json({ success: true, feeRecords });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /fees/summary/stats?year=
router.get('/summary/stats', protect, authorize('admin', 'accountant'), async (req, res) => {
  try {
    const { year = '2025-2026' } = req.query;
    const records = await StudentFee.find({ academicYear: year });
    let totalAmount = 0, totalPaid = 0;
    records.forEach(r => {
      totalAmount += r.totalAmount || 0;
      totalPaid   += r.payments.reduce((s, p) => s + (p.amount || 0), 0);
    });
    res.json({ success: true, stats: {
      totalAmount,
      totalPaid,
      totalDue: Math.max(0, totalAmount - totalPaid),
      totalStudents: records.length,
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
