const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const PDFParser = require("pdf2json");
const sharp = require('sharp');
const { extractStructuredData, classifyDocument } = require('./llmService');
const axios = require('axios');
const FormData = require('form-data');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const pdf2img = require('pdf-img-convert');

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
                            
                            // Split text by spaces and calculate proportional bounding boxes
                            let charWidth = textItem.w / Math.max(1, text.length);
                            if (charWidth > 0.8) {
                                charWidth = 0.5; // Fallback
                            }
                            
                            const tokens = text.split(/\s+/);
                            let currentOffset = 0;
                            
                            tokens.forEach(token => {
                                if (!token) return;
                                const tokenIndex = text.indexOf(token, currentOffset);
                                if (tokenIndex !== -1) {
                                    const x0_local = textItem.x + (tokenIndex * charWidth);
                                    const x1_local = x0_local + (token.length * charWidth);
                                    
                                    words.push({
                                        text: token,
                                        confidence: 100,
                                        bbox: {
                                            x0: x0_local * 25.4,
                                            y0: textItem.y * 25.4,
                                            x1: x1_local * 25.4,
                                            y1: (textItem.y + 1) * 25.4
                                        }
                                    });
                                    currentOffset = tokenIndex + token.length;
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

async function processDocument(filePath, mimetype, originalname, customSchema, llmOptions = {}) {
  let ocrResults = [];
  let pageBuffers = [];

  // 1. Identify and process file type
  if (mimetype === 'application/pdf') {
    console.log(`Processing PDF via native extraction: ${originalname}`);
    ocrResults = await parsePDF(filePath);
    
    // Scanned PDF detection
    const totalLength = ocrResults.reduce((sum, p) => sum + (p.extractedText || '').trim().length, 0);
    if (totalLength < 50) {
      console.log(`Warning: Native extraction returned extremely sparse text (${totalLength} characters). Triggering automated OCR fallback...`);
      try {
        pageBuffers = await pdf2img.convert(filePath, { width: 1500 });
        ocrResults = await performOCR(pageBuffers);
      } catch (convertErr) {
        console.error('Failed to convert scanned PDF to images for OCR fallback:', convertErr.message);
      }
    }
  } else if (mimetype.startsWith('image/')) {
    console.log(`Processing image via OCR: ${originalname}`);
    pageBuffers = [fs.readFileSync(filePath)];
    ocrResults = await performOCR(pageBuffers);
  } else {
    throw new Error('Unsupported file type');
  }

  // PII Redaction
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g,
    /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi
  ];

  for (let page of ocrResults) {
    page.words.forEach(word => {
      let isPii = false;
      for (const pattern of piiPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(word.text)) {
          isPii = true;
          break;
        }
      }
      if (isPii) word.isRedacted = true;
    });
  }

  // 2.5 Classify Document
  const fullDocumentText = ocrResults.map(p => p.extractedText || '').join('\n');
  console.log("Running LLM Classifier...");
  const classificationResult = await classifyDocument(fullDocumentText, llmOptions);
  console.log(`Classified as: ${classificationResult.document_type} (${classificationResult.confidence}%)`);

  // 2.6 Select targeted schema
  let schemaToUse = customSchema;
  if (!schemaToUse || schemaToUse.trim() === '') {
    const docTypeLower = classificationResult.document_type?.toLowerCase() || '';
    if (docTypeLower.includes('passport')) {
      schemaToUse = JSON.stringify({ passport_number: "string", surname: "string", given_names: "string", nationality: "string", date_of_birth: "string", sex: "string", place_of_birth: "string", date_of_issue: "string", date_of_expiry: "string", issuing_authority: "string", machine_readable_zone: "string" });
    } else if (docTypeLower.includes('license')) {
      schemaToUse = JSON.stringify({ license_number: "string", full_name: "string", date_of_birth: "string", address: "string", state: "string", issue_date: "string", expiration_date: "string" });
    } else if (docTypeLower.includes('resume')) {
      schemaToUse = JSON.stringify({ candidate_name: "string", email_address: "string", phone_number: "string", skills: "string array", most_recent_company: "string", most_recent_job_title: "string", education_degree: "string" });
    } else if (docTypeLower.includes('invoice')) {
      schemaToUse = JSON.stringify({ invoice_number: "string", vendor_name: "string", invoice_date: "string", due_date: "string", subtotal: "string", tax_amount: "string", total_amount_due: "string" });
    } else {
      schemaToUse = JSON.stringify({ form_title: "string", organization_name: "string", date_of_submission: "string", applicant_name: "string", status: "string" });
    }
  }

  // 2.7 Extract structured data
  for (let page of ocrResults) {
    console.log(`Extracting structured data for page ${page.pageNumber}...`);
    const imageBuffer = pageBuffers[page.pageNumber - 1] || null;
    page.structuredData = await extractStructuredData(page.extractedText, schemaToUse, imageBuffer, llmOptions);
    
    console.log("Waiting 2 seconds to respect API rate limits...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    delete page.lines;
  }

  // 3. Flatten and call Fraud Analysis
  let mergedData = {};
  ocrResults.forEach(page => {
     if(page.structuredData && !page.structuredData.error) {
        mergedData = { ...mergedData, ...page.structuredData };
     }
  });

  let fraudAnalysis = null;
  try {
    const form = new FormData();
    form.append('document', fs.createReadStream(filePath), { filename: originalname });
    form.append('extracted_data', JSON.stringify(mergedData));

    const fraudResponse = await axios.post('http://localhost:8000/analyze', form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
    fraudAnalysis = fraudResponse.data;
  } catch (error) {
    console.error("Fraud analysis failed:", error.message);
    fraudAnalysis = { error: "Fraud microservice unavailable or failed" };
  }

  const standardizedJSON = {
    documentName: originalname,
    pageCount: ocrResults.length,
    processedAt: new Date().toISOString(),
    documentType: classificationResult.document_type,
    classificationConfidence: classificationResult.confidence,
    fraudAnalysis: fraudAnalysis,
    pages: ocrResults
  };

  // Save JSON
  const outputFileName = `${path.basename(filePath, path.extname(filePath))}.json`;
  const outputPath = path.join(__dirname, '../outputs', outputFileName);
  fs.writeFileSync(outputPath, JSON.stringify(standardizedJSON, null, 2));

  return standardizedJSON;
}

async function performOCR(imageBuffers) {
  const pages = [];
  const worker = await createWorker('eng');
  try {
    for (let i = 0; i < imageBuffers.length; i++) {
      const originalMetadata = await sharp(imageBuffers[i]).metadata();
      const origWidth = originalMetadata.width || 800;
      const origHeight = originalMetadata.height || 600;

      const preprocessedBuffer = await sharp(imageBuffers[i])
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .grayscale()
        .modulate({ contrast: 2.2, brightness: 1.0 })
        .normalise()
        .sharpen({ sigma: 1 })
        .resize({ width: 2200, fit: 'inside', withoutEnlargement: true })
        .toBuffer();

      const preprocessedMetadata = await sharp(preprocessedBuffer).metadata();
      const prepWidth = preprocessedMetadata.width || 2200;
      const prepHeight = preprocessedMetadata.height || 600;

      const scaleX = origWidth / prepWidth;
      const scaleY = origHeight / prepHeight;

      const { data } = await worker.recognize(preprocessedBuffer);
      
      const words = (data.words || []).map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: { x0: w.bbox.x0 * scaleX, y0: w.bbox.y0 * scaleY, x1: w.bbox.x1 * scaleX, y1: w.bbox.y1 * scaleY }
      }));

      pages.push({ pageNumber: i + 1, extractedText: data.text.trim(), lines: [], words: words });
    }
  } finally {
    await worker.terminate();
  }
  return pages;
}

module.exports = { processDocument };
