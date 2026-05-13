const parsePDF = require('./test_pdf2json_fixed');
async function run() {
  try {
    const pages = await parsePDF('/Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/backend/uploads/document-1777451400764-592454495.pdf');
    console.log(pages[0].extractedText.substring(0, 500));
  } catch (err) {
    console.error(err);
  }
}
run();
