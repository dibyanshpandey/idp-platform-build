require('dotenv').config();
const { processDocument } = require('./services/ocrService');
const fs = require('fs');

async function run() {
  try {
    // Generate a dummy PDF
    const { PDFDocument, rgb } = require('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    page.drawText('Invoice Number 1234\nTotal 50.00\nDate 2023-10-10', { x: 50, y: 700, size: 30 });
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('/Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/backend/dummy.pdf', pdfBytes);

    const result = await processDocument(
      '/Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/backend/dummy.pdf',
      'application/pdf',
      'dummy.pdf'
    );
    console.log("SUCCESS");
    console.log(JSON.stringify(result, null, 2).slice(0, 500) + "\n...");
  } catch (error) {
    console.error("FAILED:", error);
  }
}
run();
