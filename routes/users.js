const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// @route  GET /api/users
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;
    let query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    res.json({ success: true, total, page: Number(page), users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  POST /api/users
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }
    const user = await User.create({ name, email, password, role, phone });
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  GET /api/users/:id
router.get('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('assignedClasses')
      .populate('assignedSubjects')
      .populate('studentProfile')
      .populate('children');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  PUT /api/users/:id
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    Object.assign(user, updateData);
    if (password && password.length >= 6) user.password = password; // triggers pre-save hash
    await user.save({ validateBeforeSave: false });
    const out = user.toObject();
    delete out.password;
    res.json({ success: true, message: 'User updated', user: out });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  PUT /api/users/:id/assign-children
// Body: { studentIds: ['id1','id2',...] }
router.put('/:id/assign-children', protect, authorize('admin'), async (req, res) => {
  try {
    const { studentIds = [] } = req.body;
    const parent = await User.findById(req.params.id);
    if (!parent) return res.status(404).json({ success: false, message: 'User not found' });
    if (parent.role !== 'parent')
      return res.status(400).json({ success: false, message: 'User is not a parent' });

    parent.children = studentIds;
    await parent.save({ validateBeforeSave: false });

    const populated = await User.findById(parent._id)
      .select('-password')
      .populate({ path: 'children', populate: { path: 'user', select: 'name email' } });

    res.json({ success: true, message: 'Children assigned successfully', user: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  PUT /api/users/:id/toggle-status
router.put('/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route  DELETE /api/users/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route GET /api/users/stats/summary
router.get('/stats/summary', protect, authorize('admin'), async (req, res) => {
  try {
    const [totalUsers, totalStudents, totalTeachers, totalParents, activeUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'parent' }),
      User.countDocuments({ isActive: true })
    ]);
    res.json({ success: true, stats: { totalUsers, totalStudents, totalTeachers, totalParents, activeUsers } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
