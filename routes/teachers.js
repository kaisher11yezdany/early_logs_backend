const express = require('express');
const router  = express.Router();
const Teacher = require('../models/Teacher');
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { uploadFields } = require('../middleware/upload');

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDate(val) {
  if (!val || !val.trim()) return undefined;
  const s = val.trim();
  const dmY = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmY) {
    const d = new Date(`${dmY[3]}-${dmY[2].padStart(2,'0')}-${dmY[1].padStart(2,'0')}`);
    return isNaN(d) ? undefined : d;
  }
  const d = new Date(s);
  return isNaN(d) ? undefined : d;
}
const GENDER_MAP = { male:'male', female:'female', other:'other', m:'male', f:'female' };
function normaliseGender(val) {
  return GENDER_MAP[(val||'').trim().toLowerCase()] || undefined;
}
const EMP_TYPES = ['Permanent','Contract','Part-time','Guest'];
function normaliseEmpType(val) {
  if (!val) return undefined;
  return EMP_TYPES.find(t => t.toLowerCase() === val.trim().toLowerCase()) || undefined;
}

// ── GET all teachers ──────────────────────────────────────────────────────────
// Returns all Users with role='teacher', merged with their Teacher profile (if any)
router.get('/', protect, async (req, res) => {
  try {
    const { search, department, showInactive } = req.query;
    const activeFlag = showInactive === 'true' ? false : true;

    // 1. Find all teacher-role users matching search/status
    let userQuery = { role: 'teacher', isActive: activeFlag };
    if (search) userQuery.name = { $regex: search, $options: 'i' };

    const teacherUsers = await User.find(userQuery).select('name email phone avatar isActive');

    // 2. Load Teacher profiles for those users
    let profileQuery = { user: { $in: teacherUsers.map(u => u._id) } };
    if (department) profileQuery.department = { $regex: department, $options: 'i' };

    const profiles = await Teacher.find(profileQuery);
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.user.toString()] = p; });

    // 3. Merge — users with no profile get a stub so they still appear
    let teachers = teacherUsers
      .map(u => {
        const profile = profileMap[u._id.toString()];
        if (profile) {
          profile.user = u; // attach populated user
          return profile.toObject ? { ...profile.toObject(), user: u } : { ...profile, user: u };
        }
        // Stub for teachers without a profile yet
        return { _id: u._id, user: u, employeeId: '', noProfile: true };
      })
      // If department filter active, drop stubs (they have no dept info)
      .filter(t => !department || !t.noProfile);

    res.json({ success: true, total: teachers.length, teachers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST create teacher ───────────────────────────────────────────────────────
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, phone, employeeId, userId, ...rest } = req.body;

    const dupEmp = await Teacher.findOne({ employeeId });
    if (dupEmp) return res.status(400).json({ success: false, message: 'Employee ID already exists' });

    let user;
    if (userId) {
      // Attach profile to an existing user (no-profile teacher completing their record)
      user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      if (name)  user.name  = name;
      if (phone) user.phone = phone;
      if (email && email !== user.email) {
        const existing = await User.findOne({ email, _id: { $ne: userId } });
        if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
        user.email = email;
      }
      if (password) user.password = password;
      await user.save({ validateBeforeSave: false });
    } else {
      const dupEmail = await User.findOne({ email });
      if (dupEmail) return res.status(400).json({ success: false, message: 'Email already in use' });
      user = await User.create({ name, email, password: password || employeeId, phone, role: 'teacher' });
    }

    const teacher = await Teacher.create({ user: user._id, employeeId, ...rest });

    res.status(201).json({ success: true, message: 'Teacher created', teacher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET teacher by id ─────────────────────────────────────────────────────────
// Accepts either a Teacher _id OR a User _id (for teachers without a profile)
router.get('/:id', protect, async (req, res) => {
  try {
    // 1. Try Teacher document first
    let teacher = await Teacher.findById(req.params.id)
      .populate('user', 'name email phone avatar assignedClasses assignedSubjects createdAt isActive');

    if (!teacher) {
      // 2. Maybe the ID is a User._id — look for a teacher with that user ref
      teacher = await Teacher.findOne({ user: req.params.id })
        .populate('user', 'name email phone avatar assignedClasses assignedSubjects createdAt isActive');
    }

    if (!teacher) {
      // 3. No Teacher profile at all — return the User stub so the front-end can show basic info
      const user = await User.findById(req.params.id).select('name email phone avatar isActive createdAt assignedClasses assignedSubjects');
      if (!user || user.role !== 'teacher') {
        // Also try finding by User _id regardless of role if nothing found
        const anyUser = await User.findById(req.params.id).select('name email phone avatar isActive createdAt');
        if (!anyUser) return res.status(404).json({ success: false, message: 'Teacher not found' });
        return res.json({ success: true, teacher: { _id: anyUser._id, user: anyUser, noProfile: true } });
      }
      return res.json({ success: true, teacher: { _id: user._id, user, noProfile: true } });
    }

    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PUT update teacher ────────────────────────────────────────────────────────
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, phone, password, ...teacherFields } = req.body;

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    const linkedUser = await User.findById(teacher.user);
    if (linkedUser) {
      if (name)  linkedUser.name  = name;
      if (phone) linkedUser.phone = phone;
      if (email && email !== linkedUser.email) {
        const existing = await User.findOne({ email, _id: { $ne: teacher.user } });
        if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
        linkedUser.email = email;
      }
      if (password) linkedUser.password = password;
      await linkedUser.save({ validateBeforeSave: false });
    }

    const updated = await Teacher.findByIdAndUpdate(req.params.id, teacherFields, { new: true, runValidators: false })
      .populate('user', 'name email phone');

    res.json({ success: true, message: 'Teacher updated', teacher: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST upload photo for a teacher ──────────────────────────────────────────
router.post('/:id/uploads', protect, authorize('admin'), uploadFields, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    if (!req.files?.photo?.[0])
      return res.status(400).json({ success: false, message: 'No photo uploaded' });

    const f = req.files.photo[0];
    const updated = await Teacher.findByIdAndUpdate(req.params.id, { photo: `/uploads/${f.filename}` }, { new: true });
    res.json({ success: true, message: 'Photo uploaded', photo: updated.photo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── DELETE teacher (soft) ─────────────────────────────────────────────────────
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    await Teacher.findByIdAndUpdate(req.params.id, { isActive: false });
    await User.findByIdAndUpdate(teacher.user, { isActive: false });

    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST bulk import teachers ─────────────────────────────────────────────────
router.post('/bulk', protect, authorize('admin'), async (req, res) => {
  try {
    const { teachers } = req.body;
    if (!Array.isArray(teachers) || teachers.length === 0)
      return res.status(400).json({ success: false, message: 'No teachers provided' });

    const results = [];

    for (const [i, row] of teachers.entries()) {
      const rowNum = i + 2;
      try {
        if (!row.employeeId || !row.name || !row.email) {
          results.push({ row: rowNum, success: false, employeeId: row.employeeId || '—', error: 'Missing required fields: employeeId, name, email' });
          continue;
        }

        const dupEmp = await Teacher.findOne({ employeeId: row.employeeId, isActive: true });
        if (dupEmp) {
          results.push({ row: rowNum, success: false, employeeId: row.employeeId, error: 'Employee ID already exists' });
          continue;
        }

        const dupEmail = await User.findOne({ email: row.email, isActive: true });
        if (dupEmail) {
          if (dupEmail.role === 'teacher') {
            const activeProfile = await Teacher.findOne({ user: dupEmail._id, isActive: true });
            if (activeProfile) {
              results.push({ row: rowNum, success: false, employeeId: row.employeeId, error: `Email already in use: ${row.email}` });
              continue;
            }
            await User.deleteOne({ _id: dupEmail._id });
          } else {
            results.push({ row: rowNum, success: false, employeeId: row.employeeId, error: `Email belongs to an existing ${dupEmail.role} account` });
            continue;
          }
        }

        // Clean up any soft-deleted records
        const oldTeacher = await Teacher.findOne({ employeeId: row.employeeId, isActive: false });
        if (oldTeacher) await Teacher.findByIdAndDelete(oldTeacher._id);
        await User.deleteOne({ email: row.email, isActive: false });

        const user = await User.create({
          name: row.name, email: row.email,
          password: row.password || row.employeeId,
          phone: row.phone || '', role: 'teacher',
        });

        await Teacher.create({
          user:           user._id,
          employeeId:     row.employeeId,
          designation:    row.designation    || '',
          department:     row.department     || '',
          qualification:  row.qualification  || '',
          experience:     Number(row.experience) || 0,
          joiningDate:    parseDate(row.joiningDate),
          employmentType: normaliseEmpType(row.employmentType),
          dateOfBirth:    parseDate(row.dateOfBirth),
          gender:         normaliseGender(row.gender),
          bloodGroup:     row.bloodGroup     || undefined,
          nationality:    row.nationality    || 'Indian',
          religion:       row.religion       || '',
          aadharNo:       row.aadharNo       || '',
          address: {
            street:  row.currentStreet  || '',
            city:    row.currentCity    || '',
            state:   row.currentState   || '',
            pincode: row.currentPincode || '',
          },
          permanentAddress: {
            street:  row.permanentStreet  || '',
            city:    row.permanentCity    || '',
            state:   row.permanentState   || '',
            pincode: row.permanentPincode || '',
          },
          emergencyContact: {
            name:     row.emergencyName     || '',
            relation: row.emergencyRelation || '',
            phone:    row.emergencyPhone    || '',
          },
        });

        results.push({ row: rowNum, success: true, employeeId: row.employeeId, name: row.name });
      } catch (err) {
        results.push({ row: rowNum, success: false, employeeId: row.employeeId || '—', error: err.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed    = results.filter(r => !r.success).length;
    res.json({ success: true, message: `${succeeded} imported, ${failed} failed`, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
