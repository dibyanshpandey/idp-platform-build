const { processDocument } = require('./services/ocrService');

async function run() {
  try {
    const result = await processDocument(
      '/Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/backend/uploads/document-1777451400764-592454495.pdf',
      'application/pdf',
      'real_upload.pdf'
    );
    console.log("TEXT EXTRACTED:");
    console.log(result.pages[0].extractedText.substring(0, 500));
    console.log("DATA:", JSON.stringify(result.pages[0].structuredData, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
