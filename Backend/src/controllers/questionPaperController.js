const questionPaperService = require('../services/questionPaperService');

/**
 * Handles question paper submission (POST /api/question-papers)
 */
async function submitPaper(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Reject any attempt by client to specify or spoof a different teacherId
    if (
      (req.body.teacher_id && req.body.teacher_id !== teacherId) ||
      (req.body.teacherId && req.body.teacherId !== teacherId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Client-supplied teacherId cannot override authenticated teacher identity.',
      });
    }

    // Reject any attempt by client to specify or manipulate storage path (Module 8)
    if (req.body.storage_path || req.body.storagePath) {
      return res.status(400).json({
        success: false,
        message: 'Client cannot specify storage path. Storage paths are strictly server-controlled.',
      });
    }

    // Client-supplied delivery date cannot override server value (Module 12)
    delete req.body.scheduled_delivery_date;
    delete req.body.scheduledDeliveryDate;

    const {
      title,
      subject,
      semester,
      academicYear,
      examType,
      examDate,
      assignedToUserId,
    } = req.body;

    const result = await questionPaperService.submitQuestionPaper({
      teacherId,
      title,
      subject,
      semester,
      academicYear,
      examType,
      examDate,
      assignedToUserId,
      file: req.file,
      sanitizedFileName: req.sanitizedFileName,
    });

    return res.status(201).json({
      success: true,
      message: 'Question paper submitted successfully',
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles fetching question papers authored by the authenticated teacher (GET /api/question-papers/my)
 */
async function getMyPapers(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const papers = await questionPaperService.getMyQuestionPapers(teacherId);

    return res.status(200).json({
      success: true,
      data: papers,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles fetching specific question paper metadata with ownership validation (GET /api/question-papers/:id)
 */
async function getPaperDetails(req, res, next) {
  try {
    const requesterId = req.user?.userId;
    const requesterRole = req.userRole || req.user?.role;

    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const paper = await questionPaperService.getQuestionPaperById(
      req.params.id,
      requesterId,
      requesterRole
    );

    return res.status(200).json({
      success: true,
      data: paper,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles downloading and decrypting question paper (GET /api/question-papers/:id/download)
 * Streams authenticated decrypted PDF directly to client with attachment headers.
 */
async function downloadPaper(req, res, next) {
  try {
    const requesterId = req.user?.userId;
    const requesterRole = req.userRole || req.user?.role;

    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { decryptedBuffer, fileName, mimeType } = await questionPaperService.downloadAndDecryptQuestionPaper(
      req.params.id,
      requesterId,
      requesterRole
    );

    res.setHeader('Content-Type', mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);

    return res.status(200).send(decryptedBuffer);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles retrieving eligible faculty recipients (GET /api/question-papers/recipients)
 */
async function getRecipients(req, res, next) {
  try {
    const requesterId = req.user?.userId;
    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const recipients = await questionPaperService.getEligibleRecipients(requesterId);

    return res.status(200).json({
      success: true,
      data: recipients,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles verifying question paper digital signature and integrity (GET /api/question-papers/:id/verify-signature)
 * Module 7: Evaluates RSA-PSS signature and SHA-256 hash over stored ciphertext without exposing secrets.
 */
async function verifyPaperSignature(req, res, next) {
  try {
    const requesterId = req.user?.userId;
    const requesterRole = req.userRole || req.user?.role;

    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await questionPaperService.verifyQuestionPaperIntegrity(
      req.params.id,
      requesterId,
      requesterRole
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles fetching question papers assigned to the authenticated faculty member (GET /api/question-papers/assigned)
 */
async function getAssignedPapers(req, res, next) {
  try {
    const facultyId = req.user?.userId;
    if (!facultyId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const papers = await questionPaperService.getAssignedQuestionPapers(facultyId);

    return res.status(200).json({
      success: true,
      data: papers,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

module.exports = {
  submitPaper,
  getMyPapers,
  getAssignedPapers,
  getPaperDetails,
  downloadPaper,
  getRecipients,
  verifyPaperSignature,
};

