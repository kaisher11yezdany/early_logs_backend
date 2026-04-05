const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// GET exams
router.get('/', protect, async (req, res) => {
  try {
    const { classId, subjectId, type, status } = req.query;
    let query = {};
    if (classId) query.class = classId;
    if (subjectId) query.subject = subjectId;
    if (type) query.type = type;
    if (status) query.status = status;
    const exams = await Exam.find(query)
      .populate('class', 'name section')
      .populate('subject', 'name')
      .populate('createdBy', 'name')
      .sort({ examDate: -1 });
    res.json({ success: true, exams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create exam
router.post('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const exam = await Exam.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, message: 'Exam created', exam });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT enter marks
router.put('/:id/marks', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    exam.marks = req.body.marks;
    exam.status = 'completed';
    await exam.save();
    res.json({ success: true, message: 'Marks entered', exam });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET my exam results (student)
router.get('/my/results', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const exams = await Exam.find({ class: student.class, status: 'completed' })
      .populate('subject', 'name')
      .sort({ examDate: -1 });

    const results = exams.map(e => {
      const mark = e.marks.find(m => m.student?.toString() === student._id.toString());
      return {
        _id: e._id, title: e.title, type: e.type,
        subject: e.subject, examDate: e.examDate,
        totalMarks: e.totalMarks, passingMarks: e.passingMarks,
        marksObtained: mark?.marksObtained || null,
        grade: mark?.grade || null,
        isAbsent: mark?.isAbsent || false,
        remarks: mark?.remarks || ''
      };
    });
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
