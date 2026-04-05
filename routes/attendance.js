const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// POST mark attendance
router.post('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { classId, subjectId, date, records } = req.body;
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Upsert attendance record
    const attendance = await Attendance.findOneAndUpdate(
      { class: classId, date: attendanceDate, subject: subjectId || null },
      { class: classId, subject: subjectId, date: attendanceDate, markedBy: req.user._id, records },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json({ success: true, message: 'Attendance saved', attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET attendance by class and date
router.get('/class/:classId', protect, async (req, res) => {
  try {
    const { date, month, year } = req.query;
    let query = { class: req.params.classId };
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      query.date = d;
    } else if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: start, $lte: end };
    }
    const attendance = await Attendance.find(query)
      .populate('records.student', 'admissionNo rollNo')
      .populate('subject', 'name')
      .populate('markedBy', 'name')
      .sort({ date: -1 });
    res.json({ success: true, attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET attendance for a specific student
router.get('/student/:studentId', protect, async (req, res) => {
  try {
    const { month, year } = req.query;
    let dateQuery = {};
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      dateQuery = { $gte: start, $lte: end };
    }

    const attendances = await Attendance.find({
      'records.student': req.params.studentId,
      ...(Object.keys(dateQuery).length && { date: dateQuery })
    }).populate('subject', 'name').sort({ date: -1 });

    const stats = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    const records = attendances.map(a => {
      const rec = a.records.find(r => r.student.toString() === req.params.studentId);
      if (rec) {
        stats[rec.status]++;
        stats.total++;
      }
      return { date: a.date, subject: a.subject, status: rec?.status || 'absent' };
    });

    res.json({ success: true, records, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET my attendance (for student)
router.get('/my/attendance', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const { month, year } = req.query;
    let dateQuery = {};
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      dateQuery = { $gte: start, $lte: end };
    }

    const attendances = await Attendance.find({
      'records.student': student._id,
      ...(Object.keys(dateQuery).length && { date: dateQuery })
    }).populate('subject', 'name').sort({ date: -1 });

    const stats = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    const records = attendances.map(a => {
      const rec = a.records.find(r => r.student.toString() === student._id.toString());
      if (rec) {
        stats[rec.status]++;
        stats.total++;
      }
      return { date: a.date, subject: a.subject, status: rec?.status || 'absent' };
    });

    res.json({ success: true, records, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
