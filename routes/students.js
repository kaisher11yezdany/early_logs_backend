const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// GET all students
router.get('/', protect, async (req, res) => {
  try {
    const { classId, academicYear, search, page = 1, limit = 20 } = req.query;
    let query = { isActive: true };
    if (classId) query.class = classId;
    if (academicYear) query.academicYear = academicYear;
    if (search) {
      const users = await User.find({ name: { $regex: search, $options: 'i' } }).select('_id');
      query.user = { $in: users.map(u => u._id) };
    }
    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .populate('user', 'name email phone avatar')
      .populate('class', 'name section')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ admissionNo: 1 });
    res.json({ success: true, total, students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create student
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, phone, classId, academicYear, admissionNo, rollNo, ...rest } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ success: false, message: 'Email already in use' });

    user = await User.create({ name, email, password: password || admissionNo, phone, role: 'student' });
    const student = await Student.create({
      user: user._id, admissionNo, rollNo,
      class: classId, academicYear, ...rest
    });
    user.studentProfile = student._id;
    await user.save({ validateBeforeSave: false });
    res.status(201).json({ success: true, message: 'Student created', student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET my profile (for student role) — must be before /:id
router.get('/my/profile', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id })
      .populate('user', 'name email phone avatar')
      .populate('class', 'name section academicYear')
      .populate('parentUser', 'name email phone');
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET student by id
router.get('/:id', protect, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', 'name email phone avatar')
      .populate('class', 'name section academicYear')
      .populate('parentUser', 'name email phone');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update student (also updates linked User fields)
router.put('/:id', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { name, email, phone, password, classId, ...studentFields } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Update linked User document
    const linkedUser = await User.findById(student.user);
    if (linkedUser) {
      if (name)  linkedUser.name  = name;
      if (phone) linkedUser.phone = phone;
      if (email && email !== linkedUser.email) {
        const existing = await User.findOne({ email, _id: { $ne: student.user } });
        if (existing) return res.status(400).json({ success: false, message: 'Email already in use by another account' });
        linkedUser.email = email;
      }
      if (password) linkedUser.password = password; // pre-save hook hashes it
      await linkedUser.save({ validateBeforeSave: false });
    }

    // Build student update (remap classId → class)
    const update = { ...studentFields };
    if (classId) update.class = classId;

    const updated = await Student.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: false })
      .populate('user', 'name email phone')
      .populate('class', 'name section');

    res.json({ success: true, message: 'Student updated successfully', student: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE student (removes student doc + deactivates user account)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Soft-delete the user account so historical records (attendance, marks) remain intact
    await User.findByIdAndUpdate(student.user, { isActive: false });

    // Hard-delete the student profile
    await Student.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
