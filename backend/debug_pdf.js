const PDFParser = require("pdf2json");
const fs = require('fs');

const pdfParser = new PDFParser();

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    const page = pdfData.Pages[0];
    if (page && page.Texts) {
        console.log("First 20 text items:");
        for (let i = 0; i < Math.min(20, page.Texts.length); i++) {
            const t = page.Texts[i];
            const text = decodeURIComponent(t.R[0].T);
            console.log(`Text: "${text}" | x: ${t.x}, y: ${t.y}, w: ${t.w}, sw: ${t.sw}`);
        }
    }
});

// Use a sample PDF from outputs or try the user's path if it exists
pdfParser.loadPDF("/Users/dibyanshpandey/Downloads/Sample4.pdf");
