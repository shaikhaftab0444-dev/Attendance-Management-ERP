const multer = require('multer');

// Memory storage to process CSV buffer in-memory
const storage = multer.memoryStorage();

const uploadCsv = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv files are allowed!'), false);
    }
  },
});

module.exports = {
  uploadCsv,
};
