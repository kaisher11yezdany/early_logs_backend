const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

// Ensure uploads directory exists at startup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Support multiple frontend URLs via comma-separated FRONTEND_URLS env var
    const extraUrls = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
      .split(',').map(u => u.trim()).filter(Boolean);

    const allowed =
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.railway.app') ||
      origin.endsWith('.amplifyapp.com') ||
      origin.endsWith('.cloudfront.net') ||
      origin === 'http://localhost:5173' ||
      origin === 'http://127.0.0.1:5173' ||
      origin === 'http://16.171.172.95' ||
      /^http:\/\/\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
      extraUrls.includes(origin);

    if (allowed) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded documents
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/students', require('./routes/students'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/fees', require('./routes/fees'));
app.use('/api/notices', require('./routes/notices'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/timetable', require('./routes/timetable'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Early Logs IMS API is running!', timestamp: new Date() });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

// Connect DB → seed demo data → THEN start listening
// (ensures all demo users exist before accepting any login requests)
connectDB().then(async () => {
  await autoSeed();
  app.listen(PORT, () => {
    console.log(`🚀 Server ready on http://localhost:${PORT}`);
  });
});

// ─── Auto Seed Demo Data ────────────────────────────────────────────────────
async function autoSeed() {
  try {
    const User = require('./models/User');
    const existing = await User.countDocuments();
    if (existing > 0) {
      console.log(`✅ Demo data already present (${existing} users) — skipping seed`);
      return;
    }

    console.log('🌱 Seeding demo data...');
    const Class   = require('./models/Class');
    const Subject = require('./models/Subject');
    const Student = require('./models/Student');
    const Notice  = require('./models/Notice');
    const Assignment = require('./models/Assignment');
    const Attendance = require('./models/Attendance');

    // Users
    const admin = await User.create({ name: 'Super Admin', email: 'admin@earlylogs.com', password: 'Admin@123', role: 'admin', phone: '9000000001' });
    const teacher1 = await User.create({ name: 'Priya Sharma', email: 'priya.teacher@earlylogs.com', password: 'Teacher@123', role: 'teacher', phone: '9000000002' });
    const teacher2 = await User.create({ name: 'Rahul Verma', email: 'rahul.teacher@earlylogs.com', password: 'Teacher@123', role: 'teacher', phone: '9000000003' });
    const parent   = await User.create({ name: 'Suresh Kumar', email: 'parent@earlylogs.com', password: 'Parent@123', role: 'parent', phone: '9000000004' });

    // Classes
    const class10A = await Class.create({ name: 'Class 10', section: 'A', academicYear: '2024-25', classTeacher: teacher1._id, roomNumber: '101' });
    const class9B  = await Class.create({ name: 'Class 9',  section: 'B', academicYear: '2024-25', classTeacher: teacher2._id, roomNumber: '102' });

    // Subjects
    const mathSub = await Subject.create({ name: 'Mathematics', code: 'MATH10A', class: class10A._id, teacher: teacher1._id });
    const sciSub  = await Subject.create({ name: 'Science',     code: 'SCI10A',  class: class10A._id, teacher: teacher2._id });
    const engSub  = await Subject.create({ name: 'English',     code: 'ENG10A',  class: class10A._id, teacher: teacher1._id });

    await Class.findByIdAndUpdate(class10A._id, { subjects: [mathSub._id, sciSub._id, engSub._id] });
    await User.findByIdAndUpdate(teacher1._id, { assignedClasses: [class10A._id], assignedSubjects: [mathSub._id, engSub._id] });
    await User.findByIdAndUpdate(teacher2._id, { assignedClasses: [class10A._id, class9B._id], assignedSubjects: [sciSub._id] });

    // Students
    const sUser1 = await User.create({ name: 'Aarav Kumar', email: 'aarav.student@earlylogs.com', password: 'Student@123', role: 'student', phone: '9000000005' });
    const student1 = await Student.create({
      user: sUser1._id, admissionNo: 'ADM001', rollNo: '01',
      class: class10A._id, section: 'A', academicYear: '2024-25',
      gender: 'male', dateOfBirth: new Date('2009-05-15'),
      parentInfo: { father: { name: 'Suresh Kumar', phone: '9000000004', occupation: 'Engineer' } },
      parentUser: parent._id,
      address: { street: '123 MG Road', city: 'Bangalore', state: 'Karnataka', pincode: '560001' }
    });
    await User.findByIdAndUpdate(sUser1._id, { studentProfile: student1._id });
    await User.findByIdAndUpdate(parent._id, { children: [student1._id] });

    const sUser2 = await User.create({ name: 'Sneha Patel', email: 'sneha.student@earlylogs.com', password: 'Student@123', role: 'student', phone: '9000000007' });
    const student2 = await Student.create({
      user: sUser2._id, admissionNo: 'ADM002', rollNo: '02',
      class: class10A._id, section: 'A', academicYear: '2024-25',
      gender: 'female', dateOfBirth: new Date('2009-08-22'),
      parentInfo: { father: { name: 'Rajesh Patel', phone: '9000000008', occupation: 'Businessman' } },
      address: { street: '456 Ring Road', city: 'Bangalore', state: 'Karnataka', pincode: '560002' }
    });
    await User.findByIdAndUpdate(sUser2._id, { studentProfile: student2._id });

    // Notices
    await Notice.create([
      { title: 'Welcome to Early Logs IMS!', content: 'We are pleased to launch the new Institute Management System. All users can now access their respective dashboards.', author: admin._id, targetRoles: ['all'], type: 'notice', priority: 'high' },
      { title: 'Annual Sports Day – April 15, 2024', content: 'The Annual Sports Day will be held on April 15, 2024. All students are encouraged to participate. Parents are cordially invited.', author: admin._id, targetRoles: ['all'], type: 'event', priority: 'medium' },
      { title: 'Unit Test Schedule – April 2024', content: 'Unit tests for all classes will be conducted from April 20–25, 2024. Timetable will be shared shortly.', author: teacher1._id, targetRoles: ['student', 'parent', 'teacher'], type: 'notice', priority: 'high' },
    ]);

    // Assignments
    const asgn = await Assignment.create({
      title: 'Chapter 3 – Algebra Exercises',
      description: 'Complete exercises 3.1 to 3.5 from your textbook. Show all working steps.',
      class: class10A._id, subject: mathSub._id, teacher: teacher1._id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), totalMarks: 20
    });
    // Add a submission from student1
    asgn.submissions.push({ student: student1._id, description: 'Completed all exercises. Attaching workbook.', status: 'submitted' });
    await asgn.save();

    // Attendance – last 5 days for class10A
    for (let i = 4; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      await Attendance.create({
        class: class10A._id, date: d, markedBy: teacher1._id,
        records: [
          { student: student1._id, status: i === 2 ? 'absent' : 'present' },
          { student: student2._id, status: 'present' }
        ]
      });
    }

    console.log('✅ Demo data seeded successfully!');
    console.log('');
    console.log('  Admin    → admin@earlylogs.com       / Admin@123');
    console.log('  Teacher  → priya.teacher@earlylogs.com / Teacher@123');
    console.log('  Student  → aarav.student@earlylogs.com / Student@123');
    console.log('  Parent   → parent@earlylogs.com      / Parent@123');
    console.log('');
  } catch (err) {
    console.error('⚠️  Auto-seed error:', err.message);
  }
}
