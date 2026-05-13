require('dotenv').config();
const { processDocument } = require('./services/ocrService');

async function run() {
  try {
    const result = await processDocument(
      '/Users/dibyanshpandey/.gemini/antigravity/brain/ec2e4dce-d3a1-4444-a1e7-7d18265eaa3d/sample_document_1777363449206.png',
      'image/png',
      'sample_document.png'
    );
    console.log("SUCCESS");
    console.log(JSON.stringify(result, null, 2).slice(0, 500) + "\n...");
  } catch (error) {
    console.error("FAILED:", error);
  }
}
run();
