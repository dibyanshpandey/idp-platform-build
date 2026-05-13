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
                            // This prevents pdf2json from grouping separate columns into a single giant bounding box.
                            // pdf2json sometimes sets w to the full cell width. Cap charWidth to prevent massive boxes.
                            let charWidth = textItem.w / Math.max(1, text.length);
                            if (charWidth > 0.8) {
                                charWidth = 0.5; // Fallback to an estimated 0.5 pdf units per character
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

async function processDocument(filePath, mimetype, originalname, customSchema) {
  let ocrResults = [];
  let pageBuffers = [];

  // 1. Identify and process file type
  if (mimetype === 'application/pdf') {
    console.log(`Processing PDF via native extraction: ${originalname}`);
    ocrResults = await parsePDF(filePath);
    
    // Scanned PDF detection: if the combined extracted text length is extremely low, fall back to Tesseract OCR!
    const totalLength = ocrResults.reduce((sum, p) => sum + (p.extractedText || '').trim().length, 0);
    if (totalLength < 50) {
      console.log(`Warning: Native extraction returned extremely sparse text (${totalLength} characters). This is likely a scanned PDF container. Triggering automated OCR fallback...`);
      try {
        pageBuffers = await pdf2img.convert(filePath, { width: 1500 });
        console.log(`Successfully converted scanned PDF into ${pageBuffers.length} page buffers. Running Tesseract OCR...`);
        ocrResults = await performOCR(pageBuffers);
      } catch (convertErr) {
        console.error('Failed to convert scanned PDF to images for OCR fallback:', convertErr.message);
      }
    }
  } else if (mimetype.startsWith('image/')) {
    // Direct image upload
    console.log(`Processing image via OCR: ${originalname}`);
    pageBuffers = [fs.readFileSync(filePath)];
    // 2. Perform OCR with spatial bounding box extraction
    ocrResults = await performOCR(pageBuffers);
  } else {
    throw new Error('Unsupported file type');
  }

  // PII Redaction Logic
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b(?:\d{4}[ -]?){3}\d{4}\b/g, // Credit Card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi // Email
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
      if (isPii) {
        word.isRedacted = true;
      }
    });
    // We intentionally do NOT overwrite page.extractedText here
    // so the LLM receives the actual values for extraction/export,
    // but the frontend will still render black boxes using isRedacted.
  }

  // 2.5 Classify Document first using continuous learning LLM Classifier
  const fullDocumentText = ocrResults.map(p => p.extractedText || '').join('\n');
  console.log("Running LLM Classifier...");
  const classificationResult = await classifyDocument(fullDocumentText);
  console.log(`Classified as: ${classificationResult.document_type} (${classificationResult.confidence}%)`);

  // 2.6 Select targeted schema based on classified document type for clean harvesting
  let schemaToUse = customSchema;
  
  if (!schemaToUse || schemaToUse.trim() === '') {
    const docTypeLower = classificationResult.document_type?.toLowerCase() || '';
    if (docTypeLower.includes('passport')) {
      console.log("Applying specialized PASSPORT extraction schema...");
      schemaToUse = JSON.stringify({
        passport_number: "string",
        surname: "string",
        given_names: "string",
        nationality: "string",
        date_of_birth: "string",
        sex: "string",
        place_of_birth: "string",
        date_of_issue: "string",
        date_of_expiry: "string",
        issuing_authority: "string",
        machine_readable_zone: "string"
      });
    } else if (docTypeLower.includes('license') || docTypeLower.includes('drivers_license')) {
      console.log("Applying specialized DRIVERS LICENSE extraction schema...");
      schemaToUse = JSON.stringify({
        license_number: "string",
        full_name: "string",
        date_of_birth: "string",
        address: "string",
        state: "string",
        issue_date: "string",
        expiration_date: "string"
      });
    } else if (docTypeLower.includes('resume')) {
      console.log("Applying specialized RESUME extraction schema...");
      schemaToUse = JSON.stringify({
        candidate_name: "string",
        email_address: "string",
        phone_number: "string",
        skills: "string array",
        most_recent_company: "string",
        most_recent_job_title: "string",
        education_degree: "string"
      });
    }
  }

  // 2.7 Extract structured data using LLM with cognitive-awareness schema
  for (let page of ocrResults) {
    console.log(`Extracting structured data for page ${page.pageNumber}...`);
    // Find matching image buffer for direct vision extraction
    const imageBuffer = pageBuffers[page.pageNumber - 1] || null;
    // Pass extractedText, targeted schema, and original imageBuffer to LLM matcher
    page.structuredData = await extractStructuredData(page.extractedText, schemaToUse, imageBuffer);
    
    // Rate limit prevention for API calls
    console.log("Waiting 4 seconds to respect API rate limits...");
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Remove raw lines array to keep the JSON payload manageable,
    // but KEEP page.words so the frontend can map bounding boxes!
    delete page.lines;
  }

  // 3. Flatten data and call Fraud Analysis Microservice
  let mergedData = {};
  ocrResults.forEach(page => {
     if(page.structuredData && !page.structuredData.error) {
        mergedData = { ...mergedData, ...page.structuredData };
     }
  });

  let fraudAnalysis = null;
  try {
    console.log("Calling Python Fraud Detection Microservice...");
    const form = new FormData();
    form.append('document', fs.createReadStream(filePath), { filename: originalname });
    form.append('extracted_data', JSON.stringify(mergedData));

    const fraudResponse = await axios.post('http://localhost:8000/analyze', form, {
      headers: form.getHeaders(),
      timeout: 30000 // Allow up to 30s for heavy visual forensic processing
    });
    fraudAnalysis = fraudResponse.data;
  } catch (error) {
    console.error("Fraud analysis failed:", error.message);
    fraudAnalysis = { error: "Fraud microservice unavailable or failed" };
  }

  // 4. Format into standardized JSON artifact
  const standardizedJSON = {
    documentName: originalname,
    pageCount: ocrResults.length,
    processedAt: new Date().toISOString(),
    documentType: classificationResult.document_type,
    classificationConfidence: classificationResult.confidence,
    fraudAnalysis: fraudAnalysis,
    pages: ocrResults
  };

  // 5. Save JSON locally
  const outputFileName = `${path.basename(filePath, path.extname(filePath))}.json`;
  const outputPath = path.join(__dirname, '../outputs', outputFileName);
  fs.writeFileSync(outputPath, JSON.stringify(standardizedJSON, null, 2));

  // 6. PDF Watermarking — stamp processed documents for compliance
  if (mimetype === 'application/pdf') {
    try {
      const existingPdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      
      if (pages.length > 0) {
        const firstPage = pages[0];
        const { width } = firstPage.getSize();
        const watermarkText = `PROCESSED BY IDP ENTERPRISE — ${new Date().toISOString()}`;
        const fontSize = 8;
        const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, fontSize);
        
        firstPage.drawText(watermarkText, {
          x: width - textWidth - 10,
          y: 10,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0.6, 0.6, 0.6),
          opacity: 0.5,
        });
      }

      const watermarkedBytes = await pdfDoc.save();
      const watermarkedPath = path.join(__dirname, '../outputs', `watermarked_${path.basename(filePath)}`);
      fs.writeFileSync(watermarkedPath, watermarkedBytes);
      console.log(`Watermarked PDF saved to: ${watermarkedPath}`);
    } catch (wmErr) {
      console.error('PDF watermarking failed (non-fatal):', wmErr.message);
    }
  }

  // 6.5 Image Watermarking — stamp processed images for compliance using sharp
  if (mimetype.startsWith('image/')) {
    try {
      const watermarkText = `PROCESSED BY IDP ENTERPRISE — ${new Date().toISOString()}`;
      
      const originalImage = sharp(filePath);
      const metadata = await originalImage.metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 600;

      // Make SVG matching image dimensions or scale
      const overlayWidth = Math.min(width, 1000);
      const overlayHeight = 40;
      const overlaySvg = `
        <svg width="${overlayWidth}" height="${overlayHeight}">
          <text x="${overlayWidth - 10}" y="30" font-family="sans-serif" font-size="12" fill="grey" fill-opacity="0.6" font-weight="bold" text-anchor="end">
            ${watermarkText}
          </text>
        </svg>
      `;

      const watermarkedPath = path.join(__dirname, '../outputs', `watermarked_${path.basename(filePath)}`);
      
      await originalImage
        .composite([{
          input: Buffer.from(overlaySvg),
          top: height - overlayHeight - 10,
          left: width - overlayWidth,
          blend: 'over'
        }])
        .toFile(watermarkedPath);

      console.log(`Watermarked Image saved to: ${watermarkedPath}`);
    } catch (wmErr) {
      console.error('Image watermarking failed (non-fatal):', wmErr.message);
    }
  }

  return standardizedJSON;
}

async function performOCR(imageBuffers) {
  const pages = [];
  
  // Create worker
  const worker = await createWorker('eng');

  try {
    for (let i = 0; i < imageBuffers.length; i++) {
      console.log(`Running OCR on page ${i + 1}/${imageBuffers.length}`);
      
      // Get metadata of original image for scaling calculations
      const originalMetadata = await sharp(imageBuffers[i]).metadata();
      const origWidth = originalMetadata.width || 800;
      const origHeight = originalMetadata.height || 600;

      // Specialized preprocessing pipeline for scanned/handwritten documents
      const preprocessedBuffer = await sharp(imageBuffers[i])
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // Ensure transparent backgrounds are white
        .grayscale()                                          // Remove color noise and paper tint
        .modulate({
          contrast: 2.2,
          brightness: 1.0
        })                                                    // Separate dark ink from gray paper background
        .normalise()                                          // Stretch brightness across the full range
        .sharpen({ sigma: 1 })                                // Crisp up handwritten strokes
        .resize({
          width: 2200,
          fit: 'inside',
          withoutEnlargement: true
        })                                                    // Scale to ~300 DPI to ensure readable character sizes
        .toBuffer();

      // Get dimensions of the preprocessed image to compute exact scaling ratios
      const preprocessedMetadata = await sharp(preprocessedBuffer).metadata();
      const prepWidth = preprocessedMetadata.width || 2200;
      const prepHeight = preprocessedMetadata.height || 600;

      const scaleX = origWidth / prepWidth;
      const scaleY = origHeight / prepHeight;

      const { data } = await worker.recognize(preprocessedBuffer);
      
      // Extract bounding boxes (spatial coordinates) for each word and map back to original dimensions
      const words = (data.words || []).map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: {
          x0: w.bbox.x0 * scaleX,
          y0: w.bbox.y0 * scaleY,
          x1: w.bbox.x1 * scaleX,
          y1: w.bbox.y1 * scaleY
        }
      }));

      // Extract bounding boxes for lines and map back to original dimensions
      const lines = (data.lines || []).map(l => ({
        text: l.text.trim(),
        confidence: l.confidence,
        bbox: {
          x0: l.bbox.x0 * scaleX,
          y0: l.bbox.y0 * scaleY,
          x1: l.bbox.x1 * scaleX,
          y1: l.bbox.y1 * scaleY
        }
      }));

      pages.push({
        pageNumber: i + 1,
        extractedText: data.text.trim(),
        lines: lines,
        words: words
      });
    }
  } catch (error) {
    console.error("OCR Error:", error);
    throw error;
  } finally {
    await worker.terminate();
  }

  return pages;
}

module.exports = {
  processDocument
};
