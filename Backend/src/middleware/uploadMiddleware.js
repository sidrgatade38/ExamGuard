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

/**
 * Express middleware that processes question image uploads and validates image magic bytes.
 */
const imageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp'];
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];

    if (!allowedExts.includes(ext) || !allowedMimes.includes(file.mimetype)) {
      const error = new Error('Invalid image format. Only PNG, JPEG, and WebP images are permitted.');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
    cb(null, true);
  },
});

function handleQuestionImageUpload(req, res, next) {
  const uploadHandler = imageUpload.single('image');

  uploadHandler(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Image size exceeds the allowed limit of 5 MB.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Image upload processing failed.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required.',
      });
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded image file is empty.',
      });
    }

    const buf = req.file.buffer;
    const isPng = buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isJpeg = buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const isWebp = buf.length > 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';

    if (!isPng && !isJpeg && !isWebp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image content: Header magic bytes do not match a valid PNG, JPEG, or WebP image.',
      });
    }

    const mime = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : 'image/webp';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

    req.validatedImage = {
      buffer: buf,
      mimeType: mime,
      originalName: req.file.originalname,
      size: buf.length,
      dataUrl,
    };

    next();
  });
}

function validateImageBuffer(buf, expectedMime) {
  if (!buf || buf.length < 4) {
    return { isValid: false, detectedType: null };
  }
  const isPng = buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  const isJpeg = buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isWebp = buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';

  if (!isPng && !isJpeg && !isWebp) {
    return { isValid: false, detectedType: null };
  }

  const detectedType = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : 'image/webp';
  return {
    isValid: true,
    detectedType,
  };
}

module.exports = {
  handleQuestionPaperUpload,
  handleAnswerKeyUpload,
  handleQuestionImageUpload,
  validateImageBuffer,
  sanitizeFilename,
};
