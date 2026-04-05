const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Notice = require('../models/Notice');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/early_logs_ims';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}), Class.deleteMany({}), Subject.deleteMany({}),
    Student.deleteMany({}), Notice.deleteMany({})
  ]);
  console.log('Cleared existing data');

  // Create Admin
  const admin = await User.create({
    name: 'Super Admin', email: 'admin@earlylogs.com',
    password: 'Admin@123', role: 'admin', phone: '9000000001'
  });

  // Create Teachers
  const teacher1 = await User.create({
    name: 'Priya Sharma', email: 'priya.teacher@earlylogs.com',
    password: 'Teacher@123', role: 'teacher', phone: '9000000002'
  });
  const teacher2 = await User.create({
    name: 'Rahul Verma', email: 'rahul.teacher@earlylogs.com',
    password: 'Teacher@123', role: 'teacher', phone: '9000000003'
  });

  // Create Classes
  const class10A = await Class.create({
    name: 'Class 10', section: 'A', academicYear: '2024-25',
    classTeacher: teacher1._id, roomNumber: '101'
  });
  const class9B = await Class.create({
    name: 'Class 9', section: 'B', academicYear: '2024-25',
    classTeacher: teacher2._id, roomNumber: '102'
  });

  // Create Subjects
  const mathSubject = await Subject.create({
    name: 'Mathematics', code: 'MATH10A', class: class10A._id, teacher: teacher1._id
  });
  const sciSubject = await Subject.create({
    name: 'Science', code: 'SCI10A', class: class10A._id, teacher: teacher2._id
  });
  const engSubject = await Subject.create({
    name: 'English', code: 'ENG10A', class: class10A._id, teacher: teacher1._id
  });

  // Update class with subjects
  await Class.findByIdAndUpdate(class10A._id, {
    subjects: [mathSubject._id, sciSubject._id, engSubject._id]
  });

  // Assign classes/subjects to teachers
  await User.findByIdAndUpdate(teacher1._id, {
    assignedClasses: [class10A._id], assignedSubjects: [mathSubject._id, engSubject._id]
  });
  await User.findByIdAndUpdate(teacher2._id, {
    assignedClasses: [class10A._id, class9B._id], assignedSubjects: [sciSubject._id]
  });

  // Create Parent
  const parent = await User.create({
    name: 'Suresh Kumar', email: 'parent@earlylogs.com',
    password: 'Parent@123', role: 'parent', phone: '9000000004'
  });

  // Create Students
  const studentUser1 = await User.create({
    name: 'Aarav Kumar', email: 'aarav.student@earlylogs.com',
    password: 'Student@123', role: 'student', phone: '9000000005'
  });
  const student1 = await Student.create({
    user: studentUser1._id, admissionNo: 'ADM001', rollNo: '01',
    class: class10A._id, section: 'A', academicYear: '2024-25',
    gender: 'male', dateOfBirth: new Date('2009-05-15'),
    parentInfo: {
      father: { name: 'Suresh Kumar', phone: '9000000004', occupation: 'Engineer' },
      mother: { name: 'Meena Kumar', phone: '9000000006', occupation: 'Teacher' }
    },
    parentUser: parent._id,
    address: { street: '123 MG Road', city: 'Bangalore', state: 'Karnataka', pincode: '560001' }
  });
  await User.findByIdAndUpdate(studentUser1._id, { studentProfile: student1._id });
  await User.findByIdAndUpdate(parent._id, { children: [student1._id] });

  const studentUser2 = await User.create({
    name: 'Sneha Patel', email: 'sneha.student@earlylogs.com',
    password: 'Student@123', role: 'student', phone: '9000000007'
  });
  const student2 = await Student.create({
    user: studentUser2._id, admissionNo: 'ADM002', rollNo: '02',
    class: class10A._id, section: 'A', academicYear: '2024-25',
    gender: 'female', dateOfBirth: new Date('2009-08-22'),
    parentInfo: {
      father: { name: 'Rajesh Patel', phone: '9000000008', occupation: 'Businessman' }
    },
    address: { street: '456 Ring Road', city: 'Bangalore', state: 'Karnataka', pincode: '560002' }
  });
  await User.findByIdAndUpdate(studentUser2._id, { studentProfile: student2._id });

  // Create Notices
  await Notice.create([
    {
      title: 'Welcome to Early Logs IMS!',
      content: 'We are pleased to announce the launch of our new Institute Management System. All users can now access their respective dashboards.',
      author: admin._id, targetRoles: ['all'], type: 'notice', priority: 'high'
    },
    {
      title: 'Annual Sports Day - April 15, 2024',
      content: 'The Annual Sports Day will be held on April 15, 2024. All students are encouraged to participate. Parents are cordially invited.',
      author: admin._id, targetRoles: ['all'], type: 'event', priority: 'medium'
    },
    {
      title: 'Unit Test Schedule - April 2024',
      content: 'Unit tests for all classes will be conducted from April 20-25, 2024. Timetable will be shared shortly.',
      author: teacher1._id, targetRoles: ['student', 'parent', 'teacher'], type: 'notice', priority: 'high'
    }
  ]);

  console.log('\n✅ Database seeded successfully!\n');
  console.log('=== LOGIN CREDENTIALS ===');
  console.log('Admin:   admin@earlylogs.com     | Admin@123');
  console.log('Teacher: priya.teacher@earlylogs.com | Teacher@123');
  console.log('Teacher: rahul.teacher@earlylogs.com | Teacher@123');
  console.log('Student: aarav.student@earlylogs.com | Student@123');
  console.log('Student: sneha.student@earlylogs.com | Student@123');
  console.log('Parent:  parent@earlylogs.com    | Parent@123');
  console.log('========================\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
