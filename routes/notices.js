const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');
const { protect, authorize } = require('../middleware/auth');

// GET notices (filtered by role)
router.get('/', protect, async (req, res) => {
  try {
    const query = {
      isActive: true,
      $or: [
        { targetRoles: 'all' },
        { targetRoles: req.user.role }
      ]
    };
    const notices = await Notice.find(query)
      .populate('author', 'name role')
      .sort({ publishDate: -1 })
      .limit(50);
    res.json({ success: true, notices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create notice
router.post('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const notice = await Notice.create({ ...req.body, author: req.user._id });
    res.status(201).json({ success: true, message: 'Notice created', notice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET notice by id
router.get('/:id', protect, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id).populate('author', 'name role');
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
    res.json({ success: true, notice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update notice
router.put('/:id', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, message: 'Notice updated', notice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE notice
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notice deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
