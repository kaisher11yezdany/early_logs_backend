const express = require('express');
const path = require('path');
const router = express.Router();
const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/auth');
const { uploadFields } = require('../middleware/upload');

// GET all students
router.get('/', protect, async (req, res) => {
  try {
    const { classId, academicYear, search, page = 1, limit = 20, showInactive, fromDate, toDate } = req.query;
    let query = { isActive: showInactive === 'true' ? false : true };
    if (classId) query.class = classId;
    if (academicYear) query.academicYear = academicYear;
    if (search) {
      const users = await User.find({ name: { $regex: search, $options: 'i' } }).select('_id');
      query.user = { $in: users.map(u => u._id) };
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) { const d = new Date(toDate); d.setHours(23,59,59,999); query.createdAt.$lte = d; }
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

// ── Bulk import helpers ───────────────────────────────────────────────────────

// Parse dates in DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, or any JS-parseable format
function parseDate(val) {
  if (!val || !val.trim()) return undefined;
  const s = val.trim();
  // DD-MM-YYYY or DD/MM/YYYY
  const dmY = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmY) {
    const d = new Date(`${dmY[3]}-${dmY[2].padStart(2,'0')}-${dmY[1].padStart(2,'0')}`);
    return isNaN(d) ? undefined : d;
  }
  const d = new Date(s);
  return isNaN(d) ? undefined : d;
}

// Normalise gender to lowercase enum value
const GENDER_MAP = { male: 'male', female: 'female', other: 'other', m: 'male', f: 'female' };
function normaliseGender(val) {
  return GENDER_MAP[(val || '').trim().toLowerCase()] || undefined;
}

// Extract category — strips leading digits/dashes (e.g. "4-OBC" → "OBC")
const CATEGORY_VALUES = ['General', 'OBC', 'SC', 'ST', 'Other'];
function normaliseCategory(val) {
  if (!val) return undefined;
  const clean = (val.trim().replace(/^\d+[-.\s]*/, '')).trim();
  const match = CATEGORY_VALUES.find(c => c.toLowerCase() === clean.toLowerCase());
  return match || undefined;
}

// POST bulk import students from CSV data
router.post('/bulk', protect, authorize('admin'), async (req, res) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0)
      return res.status(400).json({ success: false, message: 'No students provided' });

    // Cache class lookups to avoid repeated DB queries
    const classCache = {};
    const resolveClass = async (name, section) => {
      const key = `${(name||'').toLowerCase()}__${(section||'').toLowerCase()}`;
      if (classCache[key] !== undefined) return classCache[key];
      const cls = await Class.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        ...(section ? { section: { $regex: new RegExp(`^${section}$`, 'i') } } : {}),
      });
      classCache[key] = cls?._id || null;
      return classCache[key];
    };

    const results = [];

    for (const [i, row] of students.entries()) {
      const rowNum = i + 2; // +2 because row 1 is header
      try {
        if (!row.admissionNo || !row.name || !row.email) {
          results.push({ row: rowNum, success: false, admissionNo: row.admissionNo || '—', error: 'Missing required fields: admissionNo, name, email' });
          continue;
        }

        const dupAdmission = await Student.findOne({ admissionNo: row.admissionNo, isActive: true });
        if (dupAdmission) {
          results.push({ row: rowNum, success: false, admissionNo: row.admissionNo, error: 'Admission number already exists' });
          continue;
        }

        const dupEmail = await User.findOne({ email: row.email, isActive: true });
        if (dupEmail) {
          // Allow re-import if the user is a student with no active student profile (orphaned user)
          if (dupEmail.role === 'student') {
            const activeProfile = await Student.findOne({ user: dupEmail._id, isActive: true });
            if (activeProfile) {
              results.push({ row: rowNum, success: false, admissionNo: row.admissionNo, error: `Email already in use: ${row.email}` });
              continue;
            }
            // Orphaned student user — clean it up so we can re-create
            await User.deleteOne({ _id: dupEmail._id });
          } else {
            results.push({ row: rowNum, success: false, admissionNo: row.admissionNo, error: `Email belongs to an existing ${dupEmail.role} account` });
            continue;
          }
        }

        // Remove any soft-deleted student/user with same admissionNo or email before re-creating
        const oldStudent = await Student.findOne({ admissionNo: row.admissionNo, isActive: false });
        if (oldStudent) await Student.findByIdAndDelete(oldStudent._id);
        await User.deleteOne({ email: row.email, isActive: false });

        const classId = row.className ? await resolveClass(row.className, row.section) : null;

        const user = await User.create({
          name: row.name, email: row.email,
          password: row.password || row.admissionNo,
          phone: row.phone || '', role: 'student',
        });

        const student = await Student.create({
          user: user._id,
          admissionNo: row.admissionNo,
          rollNo:        row.rollNo        || '',
          class:         classId,
          academicYear:  row.academicYear  || '2025-2026',
          admissionDate: parseDate(row.admissionDate),
          // Identity — use normalisers so enum values and dates from any format are accepted
          dateOfBirth:  parseDate(row.dateOfBirth),
          gender:       normaliseGender(row.gender),
          bloodGroup:   row.bloodGroup   || undefined,
          caste:        row.caste        || '',
          category:     normaliseCategory(row.category),
          religion:     row.religion     || '',
          nationality:  row.nationality  || 'Indian',
          placeOfBirth: row.placeOfBirth || '',
          aadharNo:     row.aadharNo     || '',
          language:     row.language     || '',
          // Addresses
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
          // Parents
          parentInfo: {
            father: {
              name:          row.fatherName          || '',
              qualification: row.fatherQualification || '',
              occupation:    row.fatherOccupation    || '',
              aadharNo:      row.fatherAadhar        || '',
              phone:         row.fatherPhone         || '',
              email:         row.fatherEmail         || '',
            },
            mother: {
              name:          row.motherName          || '',
              qualification: row.motherQualification || '',
              occupation:    row.motherOccupation    || '',
              aadharNo:      row.motherAadhar        || '',
              phone:         row.motherPhone         || '',
              email:         row.motherEmail         || '',
            },
            guardian: {
              name:     row.guardianName     || '',
              relation: row.guardianRelation || '',
              aadharNo: row.guardianAadharNo || '',
              phone:    row.guardianPhone    || '',
            },
          },
          // Previous school
          previousSchool: {
            name:                row.prevSchoolName      || '',
            standardLastStudied: row.prevStandard        || '',
            transferNoDate:      row.prevTransferNoDate  || '',
            previousProgress:    row.prevProgress        || '',
            dateOfLeaving:       parseDate(row.prevDateOfLeaving),
            tcNoDate:            row.prevTcNoDate        || '',
            penNo:               row.prevPenNo           || '',
            satsNo:              row.prevSatsNo          || '',
            apparId:             row.prevApparId         || '',
            udiseCode:           row.prevUdiseCode       || '',
          },
        });

        user.studentProfile = student._id;
        await user.save({ validateBeforeSave: false });

        results.push({ row: rowNum, success: true, admissionNo: row.admissionNo, name: row.name });
      } catch (err) {
        results.push({ row: rowNum, success: false, admissionNo: row.admissionNo || '—', error: err.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed    = results.filter(r => !r.success).length;
    res.json({ success: true, message: `${succeeded} imported, ${failed} failed`, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST upload documents for a student
router.post('/:id/uploads', protect, authorize('admin'), uploadFields, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const docFields = ['studentAadhar', 'fatherAadhar', 'motherAadhar', 'guardianAadhar', 'transferCertificate'];
    const updates = {};

    // Handle profile photo — stored directly on student.photo
    if (req.files?.photo?.[0]) {
      const f = req.files.photo[0];
      updates['photo'] = `/uploads/${f.filename}`;
    }

    docFields.forEach(field => {
      if (req.files?.[field]?.[0]) {
        const f = req.files[field][0];
        updates[`documentUploads.${field}`] = {
          filename:     f.filename,
          originalName: f.originalname,
          mimetype:     f.mimetype
        };
      }
    });

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ success: false, message: 'No files uploaded' });

    const updated = await Student.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json({ success: true, message: 'Documents uploaded successfully', documentUploads: updated.documentUploads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE student (removes student doc + deactivates user account)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Soft-delete both the student profile and the linked user account
    await Student.findByIdAndUpdate(req.params.id, { isActive: false });
    await User.findByIdAndUpdate(student.user, { isActive: false });

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
