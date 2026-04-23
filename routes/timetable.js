const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');
const Student   = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// ── GET /api/timetable?classId=xxx&year=2025-2026 ────────────────────────────
// Used by admin (any class), teacher (their class), student (their class)
router.get('/', protect, async (req, res) => {
  try {
    const { classId, year } = req.query;
    if (!classId) return res.status(400).json({ success: false, message: 'classId is required' });

    const query = { class: classId };
    if (year) query.academicYear = year;

    const timetable = await Timetable.findOne(query).populate('class', 'name section');
    res.json({ success: true, timetable: timetable || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/timetable/my ────────────────────────────────────────────────────
// Student: auto-load their enrolled class timetable
router.get('/my', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const timetable = await Timetable
      .findOne({ class: student.class, academicYear: student.academicYear })
      .populate('class', 'name section');

    res.json({ success: true, timetable: timetable || null, classId: student.class });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/timetable ───────────────────────────────────────────────────────
// Admin only: create or fully replace a class timetable
router.put('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { classId, academicYear, timeSlots, breaks, schedule } = req.body;
    if (!classId || !academicYear)
      return res.status(400).json({ success: false, message: 'classId and academicYear are required' });

    const timetable = await Timetable.findOneAndUpdate(
      { class: classId, academicYear },
      { class: classId, academicYear, timeSlots, breaks, schedule },
      { new: true, upsert: true, runValidators: false }
    ).populate('class', 'name section');

    res.json({ success: true, timetable, message: 'Timetable saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
