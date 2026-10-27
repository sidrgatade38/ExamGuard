/**
 * ExamGuard — Standalone Documentation PDF Generator
 * Compiles Markdown documentation files into publication-grade, professionally styled PDFs
 * with genuine embedded application screenshots.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('../Backend/node_modules/pdfkit/js/pdfkit.js');

function createPdfFromMarkdown(mdFilePath, outputPdfPath, docTitle, docSubtitle) {
  return new Promise((resolve, reject) => {
    console.log(`[PDF Generator] Compiling ${mdFilePath} -> ${outputPdfPath}...`);

    const rawMd = fs.readFileSync(mdFilePath, 'utf8');
    const lines = rawMd.split(/\r?\n/);

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 55, bottom: 55, left: 45, right: 45 },
      bufferPages: true,
      autoFirstPage: true,
    });

    const writeStream = fs.createWriteStream(outputPdfPath);
    doc.pipe(writeStream);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const leftMargin = 45;
    const rightMargin = pageWidth - 45;
    const contentWidth = rightMargin - leftMargin;

    // Palette
    const cPrimary = '#0f172a';    // Slate 900
    const cSecondary = '#0284c7';  // Sky 600
    const cAccent = '#0369a1';     // Sky 700
    const cText = '#1e293b';       // Slate 800
    const cMuted = '#475569';      // Slate 600
    const cBorder = '#cbd5e1';     // Slate 300
    const cBgLight = '#f8fafc';    // Slate 50
    const cBgAlt = '#f1f5f9';      // Slate 100

    let inCodeBlock = false;
    let codeBlockLines = [];
    let inTable = false;
    let tableRows = [];

    function ensureSpace(neededHeight) {
      if (doc.y + neededHeight > pageHeight - 65) {
        doc.addPage();
      }
    }

    function renderCodeBlock(blockLines) {
      const codeText = blockLines.join('\n');
      doc.font('Courier').fontSize(7);
      const textHeight = doc.heightOfString(codeText, { width: contentWidth - 16 });
      const boxHeight = textHeight + 14;

      if (doc.y + boxHeight > pageHeight - 65) {
        doc.addPage();
      }

      const startY = doc.y;
      doc.rect(leftMargin, startY, contentWidth, boxHeight)
         .fillAndStroke('#f8fafc', '#cbd5e1');

      doc.fillColor('#0f172a')
         .text(codeText, leftMargin + 8, startY + 7, {
           width: contentWidth - 16,
           lineGap: 1.5,
         });

      doc.y = startY + boxHeight + 8;
      doc.font('Helvetica');
    }

    function renderTable(rows) {
      if (rows.length === 0) return;

      const parsedRows = rows.map(r =>
        r.replace(/^\|/, '')
         .replace(/\|$/, '')
         .split('|')
         .map(c => c.trim())
      ).filter(r => !r.every(c => /^:?-+:?$/.test(c)));

      if (parsedRows.length === 0) return;

      const numCols = parsedRows[0].length;
      if (numCols === 0) return;

      let colWidths = [];
      if (numCols === 2) {
        colWidths = [contentWidth * 0.32, contentWidth * 0.68];
      } else if (numCols === 3) {
        colWidths = [contentWidth * 0.25, contentWidth * 0.45, contentWidth * 0.30];
      } else if (numCols === 4) {
        colWidths = [contentWidth * 0.22, contentWidth * 0.28, contentWidth * 0.25, contentWidth * 0.25];
      } else {
        const uniformWidth = contentWidth / numCols;
        colWidths = Array(numCols).fill(uniformWidth);
      }

      for (let rIdx = 0; rIdx < parsedRows.length; rIdx++) {
        const row = parsedRows[rIdx];
        const isHeader = rIdx === 0;

        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(isHeader ? 8 : 7.5);

        let maxCellHeight = 16;
        for (let cIdx = 0; cIdx < numCols; cIdx++) {
          const cellText = row[cIdx] || '';
          const h = doc.heightOfString(cellText, { width: colWidths[cIdx] - 8 });
          if (h + 8 > maxCellHeight) {
            maxCellHeight = h + 8;
          }
        }

        ensureSpace(maxCellHeight + 2);

        const currentY = doc.y;
        const bgColor = isHeader ? cPrimary : (rIdx % 2 === 1 ? cBgAlt : '#ffffff');
        const textColor = isHeader ? '#ffffff' : cText;

        doc.rect(leftMargin, currentY, contentWidth, maxCellHeight)
           .fillAndStroke(bgColor, cBorder);

        let curX = leftMargin;
        for (let cIdx = 0; cIdx < numCols; cIdx++) {
          const cellText = row[cIdx] || '';
          doc.fillColor(textColor)
             .text(cellText, curX + 4, currentY + 4, {
               width: colWidths[cIdx] - 8,
               align: 'left',
             });
          curX += colWidths[cIdx];
        }

        doc.y = currentY + maxCellHeight;
      }

      doc.y += 8;
    }

    // Cover Page Header
    doc.rect(leftMargin, 50, contentWidth, 75).fill(cPrimary);
    doc.fillColor('#38bdf8').font('Helvetica-Bold').fontSize(17)
       .text(docTitle, leftMargin + 15, 65, { width: contentWidth - 30 });
    doc.fillColor('#e2e8f0').font('Helvetica').fontSize(10.5)
       .text(docSubtitle, leftMargin + 15, 92, { width: contentWidth - 30 });

    doc.y = 140;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle Code Blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          renderCodeBlock(codeBlockLines);
          codeBlockLines = [];
        } else {
          if (inTable) {
            inTable = false;
            renderTable(tableRows);
            tableRows = [];
          }
          inCodeBlock = true;
          codeBlockLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Handle Embedded Image Markdown: ![Caption](screenshots/01-login-page.png)
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) {
        if (inTable) {
          inTable = false;
          renderTable(tableRows);
          tableRows = [];
        }

        const caption = imgMatch[1];
        let imgRelPath = imgMatch[2];
        let fullImgPath = path.resolve(path.dirname(mdFilePath), imgRelPath);
        if (!fs.existsSync(fullImgPath)) {
          fullImgPath = path.resolve(__dirname, 'user-manual', imgRelPath);
        }

        if (fs.existsSync(fullImgPath)) {
          const targetWidth = Math.min(contentWidth, 420);
          const targetHeight = targetWidth * 0.62; // ~16:10 aspect ratio

          ensureSpace(targetHeight + 24);

          const startX = leftMargin + (contentWidth - targetWidth) / 2;
          const startY = doc.y + 4;

          // Border frame
          doc.rect(startX - 1, startY - 1, targetWidth + 2, targetHeight + 2)
             .strokeColor(cBorder).lineWidth(1).stroke();

          // Embed image
          doc.image(fullImgPath, startX, startY, {
            width: targetWidth,
            height: targetHeight,
          });

          doc.y = startY + targetHeight + 6;

          if (caption) {
            doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(cMuted)
               .text(caption, leftMargin, doc.y, { width: contentWidth, align: 'center' });
            doc.y += 4;
          }
          continue;
        }
      }

      // Handle Tables
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        tableRows.push(line.trim());
        continue;
      } else if (inTable) {
        inTable = false;
        renderTable(tableRows);
        tableRows = [];
      }

      // Blank line
      if (line.trim() === '') {
        doc.y += 4;
        continue;
      }

      // Horizontal Rule
      if (/^---+$/.test(line.trim())) {
        ensureSpace(16);
        doc.moveTo(leftMargin, doc.y + 4).lineTo(rightMargin, doc.y + 4).strokeColor(cBorder).lineWidth(0.5).stroke();
        doc.y += 12;
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        ensureSpace(35);
        doc.font('Helvetica-Bold').fontSize(14).fillColor(cPrimary)
           .text(line.replace(/^#\s+/, '').trim(), leftMargin, doc.y + 6);
        doc.rect(leftMargin, doc.y + 2, contentWidth, 1.5).fill(cSecondary);
        doc.y += 8;
        continue;
      }

      if (line.startsWith('## ')) {
        ensureSpace(28);
        doc.font('Helvetica-Bold').fontSize(11.5).fillColor(cAccent)
           .text(line.replace(/^##\s+/, '').trim(), leftMargin, doc.y + 6);
        doc.y += 4;
        continue;
      }

      if (line.startsWith('### ')) {
        ensureSpace(24);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(cPrimary)
           .text(line.replace(/^###\s+/, '').trim(), leftMargin, doc.y + 4);
        doc.y += 3;
        continue;
      }

      if (line.startsWith('#### ')) {
        ensureSpace(20);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(cMuted)
           .text(line.replace(/^####\s+/, '').trim(), leftMargin, doc.y + 3);
        doc.y += 2;
        continue;
      }

      // Blockquotes / Alerts
      if (line.startsWith('>')) {
        ensureSpace(24);
        const text = line.replace(/^>\s*/, '').replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/, '$1:');
        const startY = doc.y;
        doc.font('Helvetica-Oblique').fontSize(8).fillColor(cMuted);
        const h = doc.heightOfString(text, { width: contentWidth - 20 }) + 6;
        doc.rect(leftMargin, startY, contentWidth, h).fill('#f0f9ff');
        doc.rect(leftMargin, startY, 3, h).fill(cSecondary);
        doc.fillColor(cText).text(text, leftMargin + 10, startY + 3, { width: contentWidth - 20 });
        doc.y = startY + h + 6;
        doc.font('Helvetica');
        continue;
      }

      // List Items
      if (/^\s*[-*]\s+/.test(line)) {
        ensureSpace(14);
        const bulletText = line.replace(/^\s*[-*]\s+/, '').trim();
        doc.font('Helvetica').fontSize(8).fillColor(cText);
        doc.circle(leftMargin + 6, doc.y + 4, 1.5).fill(cSecondary);
        doc.text(bulletText, leftMargin + 14, doc.y, {
          width: contentWidth - 14,
          lineGap: 1.5,
        });
        doc.y += 2;
        continue;
      }

      // Numbered List Items
      if (/^\s*\d+\.\s+/.test(line)) {
        ensureSpace(14);
        const numMatch = line.match(/^\s*(\d+\.)\s+(.*)/);
        const numLabel = numMatch ? numMatch[1] : '•';
        const numText = numMatch ? numMatch[2] : line;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(cSecondary)
           .text(numLabel, leftMargin + 2, doc.y, { width: 16 });
        doc.font('Helvetica').fontSize(8).fillColor(cText)
           .text(numText, leftMargin + 20, doc.y, {
             width: contentWidth - 20,
             lineGap: 1.5,
           });
        doc.y += 2;
        continue;
      }

      // Normal Body Paragraph
      ensureSpace(14);
      doc.font('Helvetica').fontSize(8).fillColor(cText)
         .text(line.trim(), leftMargin, doc.y, {
           width: contentWidth,
           align: 'justify',
           lineGap: 2,
         });
      doc.y += 3;
    }

    if (inTable && tableRows.length > 0) {
      renderTable(tableRows);
    }
    if (inCodeBlock && codeBlockLines.length > 0) {
      renderCodeBlock(codeBlockLines);
    }

    // Two-Pass Headers and Footers
    const range = doc.bufferedPageRange();
    console.log(`[PDF Generator] Rendering ${range.count} pages with running headers & footers...`);

    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);

      // Running Header (Pages > 1)
      if (p > range.start) {
        doc.font('Helvetica').fontSize(7).fillColor(cMuted)
           .text(docTitle, leftMargin, 30, { width: contentWidth * 0.6, align: 'left' });
        doc.font('Helvetica-Oblique').fontSize(7).fillColor(cSecondary)
           .text('ExamGuard Security Documentation', leftMargin + contentWidth * 0.6, 30, { width: contentWidth * 0.4, align: 'right' });
        doc.moveTo(leftMargin, 42).lineTo(rightMargin, 42).strokeColor(cBorder).lineWidth(0.5).stroke();
      }

      // Running Footer (All Pages)
      doc.moveTo(leftMargin, pageHeight - 40).lineTo(rightMargin, pageHeight - 40).strokeColor(cBorder).lineWidth(0.5).stroke();
      doc.font('Helvetica').fontSize(7).fillColor(cMuted)
         .text('ExamGuard — Confidential Examination Question Paper System', leftMargin, pageHeight - 32, { width: contentWidth * 0.7, align: 'left' });
      doc.font('Helvetica-Bold').fontSize(7).fillColor(cPrimary)
         .text(`Page ${p + 1} of ${range.count}`, leftMargin + contentWidth * 0.7, pageHeight - 32, { width: contentWidth * 0.3, align: 'right' });
    }

    doc.end();

    writeStream.on('finish', () => {
      console.log(`[PDF Generator] Successfully compiled ${outputPdfPath} (${range.count} pages)`);
      resolve(range.count);
    });

    writeStream.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    const userManualMd = path.resolve(__dirname, 'user-manual/ExamGuard_User_Manual.md');
    const userManualPdf = path.resolve(__dirname, 'user-manual/ExamGuard_User_Manual.pdf');
    const p1 = await createPdfFromMarkdown(
      userManualMd,
      userManualPdf,
      'ExamGuard — Simple Step-by-Step User Manual',
      'Beginner-Friendly Operational & Interface Guide with Real Application Screenshots'
    );

    const technicalHandbookMd = path.resolve(__dirname, 'technical-handbook/ExamGuard_Technical_Viva_Handbook.md');
    const technicalHandbookPdf = path.resolve(__dirname, 'technical-handbook/ExamGuard_Technical_Viva_Handbook.pdf');
    const p2 = await createPdfFromMarkdown(
      technicalHandbookMd,
      technicalHandbookPdf,
      'ExamGuard — Technical Documentation & Viva Defense Handbook',
      'Easy-to-Study Architecture, Codebase Walkthroughs, Cryptographic Specs & 50+ Viva Questions'
    );

    console.log(`\n========================================`);
    console.log(`  BOTH PDFS REBUILT CLEANLY WITH REAL SCREENSHOTS!`);
    console.log(`  1. User Manual: ${userManualPdf} (${p1} pages)`);
    console.log(`  2. Technical Handbook: ${technicalHandbookPdf} (${p2} pages)`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error('[PDF Generator] Error:', err);
    process.exit(1);
  }
}

main();
