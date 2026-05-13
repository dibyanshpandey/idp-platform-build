const sharp = require('sharp');
const fs = require('fs');
const { createWorker } = require('tesseract.js');

async function run() {
  const buffer = fs.readFileSync('/Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/backend/dummy_page.png');
  const flattened = await sharp(buffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } }) // White background
    .png()
    .toBuffer();
    
  fs.writeFileSync('dummy_page_flattened.png', flattened);
  
  const worker = await createWorker('eng');
  const ret = await worker.recognize(flattened);
  console.log("TEXT EXTRACTED WITH SHARP FLATTEN:");
  console.log(ret.data.text);
  await worker.terminate();
}
run();
