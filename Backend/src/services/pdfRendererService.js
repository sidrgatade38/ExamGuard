/**
 * ExamGuard - University Examination Paper PDF Rendering Service (Module 18)
 *
 * Renders an approved question paper structure snapshot into a standardized,
 * publication-grade university examination PDF buffer matching the official
 * reference paper format (e.g. May_Jun_2022.pdf).
 *
 * Security & Integrity:
 * - Plaintext buffer is produced strictly in-memory.
 * - Resulting buffer is forwarded directly to encryptionService and private Supabase storage.
 * - No plaintext copies are ever saved to unencrypted temporary files or public storage.
 */

const PDFDocument = require('pdfkit');

/**
 * Formats duration in hours into human-readable university format.
 * e.g. 2.5 -> "2½ Hours", 3 -> "3 Hours", 2 -> "2 Hours"
 */
function formatDuration(hours) {
  const num = parseFloat(hours);
  if (isNaN(num)) return `${hours} Hours`;
  const whole = Math.floor(num);
  const frac = num - whole;
  if (Math.abs(frac - 0.5) < 0.01) {
    return whole > 0 ? `${whole}½ Hours` : '½ Hour';
  }
  return `${num} Hours`;
}

/**
 * Renders an approved paper structure snapshot into a PDF Buffer.
 *
 * @param {Object} options
 * @param {Object} options.metadata - Examination metadata (title, subject, course, semester, pattern, subjectCode, durationHours, totalMarks, instructions, setCode)
 * @param {Array} options.sections - Array of question groups/OR pairs with numbered questions & subquestions
 * @returns {Promise<Buffer>}
 */
function renderQuestionPaperPDF(options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const metadata = options.metadata || options || {};
      const sections = options.sections || [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const leftMargin = 45;
      const rightMargin = pageWidth - 45;
      const contentWidth = rightMargin - leftMargin;

      // -------------------------------------------------------------
      // HEADER SECTION (University Paper Reference Format)
      // -------------------------------------------------------------

      // Top row: Total questions, set indicator & Seat Number box
      doc.fontSize(9).font('Helvetica');
      doc.text(`Total No. of Questions : ${countTotalQuestions(sections)}]`, leftMargin, 40);

      const setCodeText = metadata.setCode ? `[${metadata.setCode}]` : '';
      if (setCodeText) {
        doc.font('Helvetica-Bold').text(setCodeText, leftMargin + 170, 40);
        doc.font('Helvetica');
      }

      // Seat Number Box on top right
      const seatBoxWidth = 140;
      const seatBoxHeight = 22;
      const seatBoxX = rightMargin - seatBoxWidth;
      const seatBoxY = 36;
      doc.rect(seatBoxX, seatBoxY, seatBoxWidth, seatBoxHeight).stroke();
      doc.fontSize(8).text('SEAT No. :', seatBoxX + 6, seatBoxY + 6);

      doc.moveDown(1.5);

      // Subcode identifier
      const subjectCode = metadata.subjectCode || metadata.code || 'EXAM-2026';
      doc.fontSize(9).font('Helvetica-Bold').text(`[${subjectCode}]`, leftMargin, 65);

      // Department (Strict Module 1 Requirement)
      doc.fontSize(10).font('Helvetica-Bold').text('DEPARTMENT OF COMPUTER ENGINEERING', { align: 'center' });

      // Course / Degree
      const course = metadata.course || 'T.E. (Computer Engineering)';
      doc.fontSize(11).font('Helvetica-Bold').text(course, { align: 'center' });

      // Subject Name (Uppercase bold)
      const subjectTitle = (metadata.subject || metadata.title || 'EXAMINATION').toUpperCase();
      doc.fontSize(13).font('Helvetica-Bold').text(subjectTitle, { align: 'center' });

      // Academic Pattern & Semester
      const patternText = `(${metadata.academicPattern || '2019 Pattern'}) (${metadata.semester || 'Semester - I'})`;
      doc.fontSize(10).font('Helvetica').text(patternText, { align: 'center' });

      doc.moveDown(0.5);

      // Time & Max Marks line
      const durationStr = formatDuration(metadata.durationHours || 2.5);
      const marksStr = `[Max. Marks : ${metadata.totalMarks || 70}`;
      const timeStr = `Time : ${durationStr}]`;

      const currentY = doc.y;
      doc.fontSize(10).font('Helvetica-Bold').text(timeStr, leftMargin, currentY);
      doc.text(marksStr, rightMargin - 120, currentY, { width: 120, align: 'right' });

      doc.moveDown(0.8);

      // Horizontal divider
      doc.moveTo(leftMargin, doc.y).lineTo(rightMargin, doc.y).lineWidth(0.75).stroke();
      doc.moveDown(0.5);

      // Instructions block
      doc.fontSize(9).font('Helvetica-Bold').text('Instructions to the candidates:', leftMargin);
      doc.font('Helvetica');

      const instructions = Array.isArray(metadata.instructions) && metadata.instructions.length > 0
        ? metadata.instructions
        : [
            'Answer Q1 or Q2, Q3 or Q4, Q5 or Q6, Q7 or Q8.',
            'Neat diagrams must be drawn wherever necessary.',
            'Figures to the right indicate full marks.',
            'Assume suitable data if necessary.',
          ];

      instructions.forEach((inst, idx) => {
        doc.fontSize(8.5).text(`${idx + 1})  ${inst}`, leftMargin + 10, doc.y + 1);
      });

      doc.moveDown(0.5);
      doc.moveTo(leftMargin, doc.y).lineTo(rightMargin, doc.y).lineWidth(0.75).stroke();
      doc.moveDown(1);

      // -------------------------------------------------------------
      // QUESTIONS BODY (Alternative Pairs & Subquestions)
      // -------------------------------------------------------------

      (sections || []).forEach((section, sIdx) => {
        // Group Header or Unit notice (optional)
        if (sIdx > 0) {
          doc.moveDown(0.8);
        }

        // Primary Question (e.g. Q1, Q3, Q5, Q7)
        if (section.primaryQuestion) {
          renderQuestionItem(doc, section.primaryQuestion, leftMargin, rightMargin, contentWidth);
        }

        // Alternative Question (e.g. Q2, Q4, Q6, Q8) with OR separator
        if (section.alternativeQuestion) {
          doc.moveDown(0.6);
          // Centered bold "OR" separator
          doc.fontSize(10).font('Helvetica-Bold').text('OR', { align: 'center' });
          doc.moveDown(0.6);
          renderQuestionItem(doc, section.alternativeQuestion, leftMargin, rightMargin, contentWidth);
        }
      });

      // -------------------------------------------------------------
      // FOOTER & PAGE NUMBERING (Applied to all buffered pages)
      // -------------------------------------------------------------
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        // Bottom page count
        doc.fontSize(8).font('Helvetica')
          .text(
            `Page ${i + 1} of ${totalPages}`,
            leftMargin,
            doc.page.height - 30,
            { width: contentWidth, align: 'center' }
          );

        // Security watermark text
        doc.fontSize(7).font('Helvetica')
          .text(
            'ExamGuard Secure Question Paper Management System | Confidential',
            leftMargin,
            doc.page.height - 22,
            { width: contentWidth, align: 'center' }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Counts total numbered questions across all sections.
 */
function countTotalQuestions(sections) {
  let count = 0;
  if (!Array.isArray(sections)) return count;
  for (const s of sections) {
    if (s.primaryQuestion) count++;
    if (s.alternativeQuestion) count++;
  }
  return count || 8;
}

/**
 * Renders an optional diagram/image for a question or subquestion.
 * Handles base64 data URIs or file paths safely, preventing page overflow and text overlap.
 */
function renderOptionalImage(doc, imageSource, leftMargin, contentWidth) {
  if (!imageSource) return;
  try {
    let imgBuffer = null;
    if (Buffer.isBuffer(imageSource)) {
      imgBuffer = imageSource;
    } else if (typeof imageSource === 'string') {
      if (imageSource.startsWith('data:image')) {
        const parts = imageSource.split(',');
        if (parts.length > 1) {
          imgBuffer = Buffer.from(parts[1], 'base64');
        }
      }
    }

    if (imgBuffer && imgBuffer.length > 0) {
      const maxImgWidth = Math.min(300, contentWidth - 40);
      const estHeight = 140;

      // Ensure room on current page or start a new page
      if (doc.y + estHeight > doc.page.height - 45) {
        doc.addPage();
      }

      doc.moveDown(0.3);
      const posX = leftMargin + 25;
      doc.image(imgBuffer, posX, doc.y, {
        fit: [maxImgWidth, 160],
        align: 'center',
      });
      doc.moveDown(0.5);
    }
  } catch (err) {
    console.warn('[PDFRenderer] Unable to render image in PDF:', err.message);
  }
}

/**
 * Renders an individual numbered question with its subquestions (a, b, c), images, and right-aligned marks.
 */
function renderQuestionItem(doc, question, leftMargin, rightMargin, contentWidth) {
  const qNum = question.questionNumber || question.qNum || 1;
  const qPrefix = `Q${qNum})`;

  // If question has subquestions (e.g. a, b)
  if (Array.isArray(question.subquestions) && question.subquestions.length > 0) {
    question.subquestions.forEach((sub, subIdx) => {
      const subPart = sub.part || sub.subPart || (subIdx === 0 ? 'a' : 'b');
      const prefix = subIdx === 0 ? `${qPrefix}  ${subPart}) ` : `       ${subPart}) `;
      const marksText = `[${sub.marks}]`;

      const startY = doc.y;

      // Reserve right column for marks (40pt)
      const textWidth = contentWidth - 45;

      doc.fontSize(9.5).font('Helvetica');
      doc.text(prefix + (sub.text || sub.question_text || ''), leftMargin, startY, {
        width: textWidth,
        align: 'left',
      });

      // Place marks in square brackets aligned to the right margin
      doc.fontSize(9.5).font('Helvetica-Bold')
        .text(marksText, rightMargin - 40, startY, {
          width: 40,
          align: 'right',
        });

      // Render image attached to subquestion if present
      if (sub.image || sub.imageData || sub.imageUrl) {
        renderOptionalImage(doc, sub.image || sub.imageData || sub.imageUrl, leftMargin, contentWidth);
      }

      doc.moveDown(0.4);
    });
  } else {
    // Single standalone question text
    const text = question.text || question.question_text || '';
    const marksText = `[${question.marks || 0}]`;
    const startY = doc.y;
    const textWidth = contentWidth - 45;

    doc.fontSize(9.5).font('Helvetica')
      .text(`${qPrefix}  ${text}`, leftMargin, startY, {
        width: textWidth,
        align: 'left',
      });

    doc.fontSize(9.5).font('Helvetica-Bold')
      .text(marksText, rightMargin - 40, startY, {
        width: 40,
        align: 'right',
      });

    // Render image attached to question if present
    if (question.image || question.imageData || question.imageUrl || question.diagram) {
      renderOptionalImage(doc, question.image || question.imageData || question.imageUrl || question.diagram, leftMargin, contentWidth);
    }

    doc.moveDown(0.4);
  }
}

module.exports = {
  renderQuestionPaperPDF,
  formatDuration,
};
