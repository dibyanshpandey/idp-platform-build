const { createWorker } = require('tesseract.js');
async function run() {
  const worker = await createWorker('eng');
  const ret = await worker.recognize('/Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/backend/dummy_page.png');
  console.log("TEXT:");
  console.log(ret.data.text);
  await worker.terminate();
}
run();
