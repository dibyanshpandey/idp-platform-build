const PDFParser = require("pdf2json");

function parsePDF(pdfPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", pdfData => {
            const pages = pdfData.Pages.map((page, index) => {
                const words = [];
                let fullText = "";
                
                if (page.Texts) {
                    page.Texts.forEach(textItem => {
                        // textItem.R is an array of runs
                        const textRun = textItem.R[0];
                        if (textRun) {
                            const text = decodeURIComponent(textRun.T);
                            fullText += text + " ";
                            words.push({
                                text: text,
                                confidence: 100, // Native PDF, confidence is 100%
                                bbox: {
                                    x0: textItem.x,
                                    y0: textItem.y,
                                    x1: textItem.x + textItem.w,
                                    y1: textItem.y + 1 // Approximating height if not easily available
                                }
                            });
                        }
                    });
                }

                return {
                    pageNumber: index + 1,
                    fullText: fullText.trim(),
                    lines: [], // To keep it simple, we can leave lines empty or approximate
                    words: words
                };
            });
            resolve(pages);
        });
        pdfParser.loadPDF(pdfPath);
    });
}
module.exports = parsePDF;
