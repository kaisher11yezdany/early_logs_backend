const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = file.fieldname.replace(/[^a-z0-9]/gi, '_');
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/i;
  if (allowed.test(path.extname(file.originalname)) && allowed.test(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Only PDF, JPG, PNG files are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter
});

// Fields accepted for student document uploads
const uploadFields = upload.fields([
  { name: 'studentAadhar',       maxCount: 1 },
  { name: 'fatherAadhar',        maxCount: 1 },
  { name: 'motherAadhar',        maxCount: 1 },
  { name: 'guardianAadhar',      maxCount: 1 },
  { name: 'transferCertificate', maxCount: 1 },
]);

module.exports = { upload, uploadFields };
