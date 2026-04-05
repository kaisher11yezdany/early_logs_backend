const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const { protect, authorize } = require('../middleware/auth');

// GET all classes
router.get('/', protect, async (req, res) => {
  try {
    const { academicYear, isActive } = req.query;
    let query = {};
    if (academicYear) query.academicYear = academicYear;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    const classes = await Class.find(query)
      .populate('classTeacher', 'name email')
      .populate('subjects', 'name code')
      .sort({ name: 1, section: 1 });
    res.json({ success: true, classes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create class
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const cls = await Class.create(req.body);
    res.status(201).json({ success: true, message: 'Class created', class: cls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET class by id
router.get('/:id', protect, async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate('classTeacher', 'name email phone')
      .populate('subjects');
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
    res.json({ success: true, class: cls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update class
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cls) return res.status(404).json({ success: false, message: 'Class not found' });
    res.json({ success: true, message: 'Class updated', class: cls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE class
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Class deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET subjects for a class
router.get('/:id/subjects', protect, async (req, res) => {
  try {
    const subjects = await Subject.find({ class: req.params.id })
      .populate('teacher', 'name email');
    res.json({ success: true, subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
