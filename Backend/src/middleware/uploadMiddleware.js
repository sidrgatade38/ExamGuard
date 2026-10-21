const multer = require('multer');
const path = require('path');
const config = require('../config');

// Calculate max file size in bytes
const maxSizeBytes = (config.maxQuestionPaperSizeMb || 10) * 1024 * 1024;

// Memory storage keeps file buffers in memory for direct Supabase Storage stream/upload
const storage = multer.memoryStorage();

/**
 * Filter strictly allowing PDF files based on MIME type and extension
 */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfExt = ext === '.pdf';

  if (!isPdfMime || !isPdfExt) {
    const error = new Error('Invalid file type. Only PDF documents (.pdf) are permitted.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  cb(null, true);
}

const upload = multer({
  storage,
  limits: {
    fileSize: maxSizeBytes,
    files: 1,
  },
  fileFilter,
});

/**
 * Sanitizes a filename to protect against path traversal and special characters.
 * @param {string} originalName
 * @returns {string} Sanitized filename ending in .pdf
 */
function sanitizeFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    return `paper_${Date.now()}.pdf`;
  }

  // Strip directory paths / path traversal sequences
  const baseName = path.basename(originalName);

  // Remove dangerous characters, allow only letters, digits, dashes, underscores, and dots
  let sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Collapse multiple underscores or dots
  sanitized = sanitized.replace(/\.{2,}/g, '.');
  sanitized = sanitized.replace(/_{2,}/g, '_');

  // Ensure it has .pdf extension
  if (!sanitized.toLowerCase().endsWith('.pdf')) {
    sanitized += '.pdf';
  }

  // Ensure not empty before extension
  if (sanitized === '.pdf' || sanitized.length <= 4) {
    sanitized = `paper_${Date.now()}.pdf`;
  }

  return sanitized;
}

/**
 * Express middleware that processes the multipart 'file' field and validates PDF integrity.
 */
function handleQuestionPaperUpload(req, res, next) {
  const singleUpload = upload.single('file');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `File size exceeds the allowed limit of ${config.maxQuestionPaperSizeMb || 10} MB.`,
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload processing failed.',
      });
    }

    // 1. Verify file exists in request
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Question paper PDF file is required.',
      });
    }

    // 2. Reject empty files
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file is empty (0 bytes).',
      });
    }

    // 3. Inspect PDF magic bytes (%PDF-) to prevent disguised files
    const magicBytes = req.file.buffer.slice(0, 5).toString('ascii');
    if (!magicBytes.startsWith('%PDF-')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file content. The uploaded document does not have a valid PDF header.',
      });
    }

    // 4. Sanitize filename and attach to request
    req.sanitizedFileName = sanitizeFilename(req.file.originalname);

    next();
  });
}

/**
 * Express middleware that processes the multipart 'file' field for Answer Key uploads.
 */
function handleAnswerKeyUpload(req, res, next) {
  const singleUpload = upload.single('file');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `File size exceeds the allowed limit of ${config.maxQuestionPaperSizeMb || 10} MB.`,
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload processing failed.',
      });
    }

    // 1. Verify file exists in request
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Answer key PDF file is required.',
      });
    }

    // 2. Reject empty files
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file is empty (0 bytes).',
      });
    }

    // 3. Inspect PDF magic bytes (%PDF-) to prevent disguised files
    const magicBytes = req.file.buffer.slice(0, 5).toString('ascii');
    if (!magicBytes.startsWith('%PDF-')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file content. The uploaded document does not have a valid PDF header.',
      });
    }

    // 4. Sanitize filename and attach to request
    req.sanitizedFileName = sanitizeFilename(req.file.originalname);

    next();
  });
}

module.exports = {
  handleQuestionPaperUpload,
  handleAnswerKeyUpload,
  sanitizeFilename,
};
