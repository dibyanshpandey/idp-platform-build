const fs = require('fs');
const pdf2img = require('pdf-img-convert');

async function run() {
  const filePath = '/Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/backend/dummy.pdf';
  const images = await pdf2img.convert(filePath, { base64: false, scale: 2.0 });
  fs.writeFileSync('dummy_page.png', Buffer.from(images[0]));
  console.log("Saved dummy_page.png");
}
run();
