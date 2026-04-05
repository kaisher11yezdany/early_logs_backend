const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// GET assignments
router.get('/', protect, async (req, res) => {
  try {
    const { classId, subjectId, teacherId } = req.query;
    let query = { isActive: true };
    if (classId) query.class = classId;
    if (subjectId) query.subject = subjectId;
    if (teacherId) query.teacher = teacherId;
    const assignments = await Assignment.find(query)
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create assignment
router.post('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const assignment = await Assignment.create({ ...req.body, teacher: req.user._id });
    res.status(201).json({ success: true, message: 'Assignment created', assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET assignment by id
router.get('/:id', protect, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('class', 'name section')
      .populate('subject', 'name')
      .populate('teacher', 'name email')
      .populate('submissions.student', 'admissionNo rollNo');
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST submit assignment (student)
router.post('/:id/submit', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    const alreadySubmitted = assignment.submissions.find(
      s => s.student.toString() === student._id.toString()
    );
    if (alreadySubmitted) {
      alreadySubmitted.description = req.body.description || alreadySubmitted.description;
      alreadySubmitted.submittedAt = new Date();
    } else {
      const isLate = new Date() > new Date(assignment.dueDate);
      assignment.submissions.push({
        student: student._id,
        description: req.body.description,
        status: isLate ? 'late' : 'submitted'
      });
    }
    await assignment.save();
    res.json({ success: true, message: 'Assignment submitted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT evaluate submission (teacher)
router.put('/:id/evaluate/:studentId', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    const submission = assignment.submissions.find(
      s => s.student.toString() === req.params.studentId
    );
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
    submission.marks = req.body.marks;
    submission.feedback = req.body.feedback;
    submission.status = 'evaluated';
    await assignment.save();
    res.json({ success: true, message: 'Submission evaluated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET my assignments (student)
router.get('/my/assignments', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const assignments = await Assignment.find({ class: student.class, isActive: true })
      .populate('subject', 'name code')
      .populate('teacher', 'name')
      .sort({ dueDate: 1 });

    const result = assignments.map(a => {
      const sub = a.submissions.find(s => s.student.toString() === student._id.toString());
      return {
        _id: a._id, title: a.title, description: a.description,
        subject: a.subject, teacher: a.teacher,
        dueDate: a.dueDate, totalMarks: a.totalMarks,
        submission: sub || null,
        status: sub ? sub.status : (new Date() > new Date(a.dueDate) ? 'overdue' : 'pending')
      };
    });
    res.json({ success: true, assignments: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
