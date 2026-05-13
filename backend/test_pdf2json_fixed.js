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
                        const textRun = textItem.R[0];
                        if (textRun) {
                            let text = textRun.T;
                            try {
                                text = decodeURIComponent(text);
                            } catch(e) {
                                // Ignore malformed URI and leave as is
                            }
                            fullText += text + " ";
                            words.push({
                                text: text,
                                confidence: 100,
                                bbox: {
                                    x0: textItem.x * 25.4, // Convert to mm or points for compatibility if needed, though PDF coordinates are their own thing
                                    y0: textItem.y * 25.4,
                                    x1: (textItem.x + textItem.w) * 25.4,
                                    y1: (textItem.y + 1) * 25.4
                                }
                            });
                        }
                    });
                }

                return {
                    pageNumber: index + 1,
                    extractedText: fullText.trim(),
                    lines: [],
                    words: words
                };
            });
            resolve(pages);
        });
        pdfParser.loadPDF(pdfPath);
    });
}
module.exports = parsePDF;
