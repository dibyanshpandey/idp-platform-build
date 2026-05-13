const { createWorker } = require('tesseract.js');
(async () => {
  const worker = await createWorker('eng');
  const ret = await worker.recognize('/Users/dibyanshpandey/.gemini/antigravity/brain/ec2e4dce-d3a1-4444-a1e7-7d18265eaa3d/sample_document_1777363449206.png');
  console.log(Object.keys(ret));
  console.log(Object.keys(ret.data || {}));
  await worker.terminate();
})();
