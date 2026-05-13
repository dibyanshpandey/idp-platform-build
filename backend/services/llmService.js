const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

function loadCorrections() {
  try {
    const correctionsPath = path.join(__dirname, '../data/corrections.json');
    const data = fs.readFileSync(correctionsPath, 'utf8');
    const corrections = JSON.parse(data);
    return corrections.slice(-5);
  } catch (e) {
    return [];
  }
}

function loadClassificationCorrections() {
  try {
    const correctionsPath = path.join(__dirname, '../data/classification_corrections.json');
    const data = fs.readFileSync(correctionsPath, 'utf8');
    const corrections = JSON.parse(data);
    return corrections.slice(-5);
  } catch (e) {
    return [];
  }
}

async function extractStructuredData(rawText, customSchema, imageBuffer) {
  if (!process.env.GROQ_API_KEY) {
    console.warn("GROQ_API_KEY is not set. Returning raw text.");
    return { extracted_raw_text: rawText };
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  let schemaInstruction = `3. Work on ANY document type (invoices, resumes, forms, letters, etc.) and extract the natural key-value pairs present.`;
  if (customSchema && customSchema.trim() !== '') {
    schemaInstruction = `3. STRICT SCHEMA ENFORCEMENT: You must extract data matching EXACTLY the following JSON schema. Do not add keys that are not in this schema.\nSchema: ${customSchema}`;
  }

  // Build few-shot learning block from operator corrections
  let fewShotBlock = '';
  const corrections = loadCorrections();
  if (corrections.length > 0) {
    const examples = corrections.map(c => 
      `  - Field "${c.field}": Incorrect="${c.wrong}" → Correct="${c.correct}"`
    ).join('\n');
    fewShotBlock = `\n  LEARNING FROM PAST CORRECTIONS (apply these patterns to similar fields):\n${examples}\n`;
  }

  // 1. If we have an imageBuffer, attempt direct multimodal extraction first (excellent for scans/handwriting)
  if (imageBuffer) {
    try {
      console.log("Attempting direct multimodal image-based structured extraction...");
      const base64Image = imageBuffer.toString('base64');

      const systemPrompt = `
      You are an expert document extraction API. 
      Your task is to analyze the provided document image and extract all relevant key-value pairs.
      
      CRITICAL INSTRUCTIONS:
      1. Extract information exactly as it appears in the image.
      2. DO NOT hallucinate, infer, guess, or assume any missing data. If a field is not explicitly present in the text, DO NOT include it in the output.
      ${schemaInstruction}
      4. Return ONLY a valid, flat JSON object.
      5. The keys must be snake_case representations of the field names.
      6. The values must be the exact strings as they appear in the image.
      ${fewShotBlock}`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Please extract the requested fields directly from this document image:" },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        response_format: { type: "json_object" }
      });

      let responseText = chatCompletion.choices[0]?.message?.content || '{}';
      responseText = responseText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();

      const extractedJSON = JSON.parse(responseText);
      console.log("Direct multimodal image-based structured extraction successful!");
      return extractedJSON;
    } catch (error) {
      console.error("Direct visual extraction failed, falling back to text-based extraction:", error.message);
    }
  }

  // 2. Standard text-only extraction (fallback or digital-text native documents)
  console.log("Running standard text-only structured extraction...");
  const systemPrompt = `
  You are an expert document extraction API. 
  Your task is to extract all relevant key-value pairs from the following OCR text.
  
  CRITICAL INSTRUCTIONS:
  1. Extract information exactly as it appears in the text.
  2. DO NOT hallucinate, infer, guess, or assume any missing data. If a field is not explicitly present in the text, DO NOT include it in the output.
  ${schemaInstruction}
  4. Return ONLY a valid, flat JSON object.
  5. The keys must be snake_case representations of the field names.
  6. The values must be the exact strings as they appear in the text.
  ${fewShotBlock}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Document Text:\n${rawText}` }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" }
    });

    let responseText = chatCompletion.choices[0]?.message?.content || '{}';
    responseText = responseText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();

    const extractedJSON = JSON.parse(responseText);
    return extractedJSON;
  } catch (error) {
    console.error("LLM Extraction failed:", error);
    return { error: "LLM extraction failed", details: error.message, rawText };
  }
}

async function classifyDocument(rawText) {
  if (!process.env.GROQ_API_KEY) {
    console.warn("GROQ_API_KEY is not set. Defaulting classification.");
    return { document_type: "Structured Form", confidence: 100 };
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Build classification few-shot block from learning repository
  let fewShotBlock = '';
  const corrections = loadClassificationCorrections();
  if (corrections.length > 0) {
    const examples = corrections.map(c => 
      `  - If text indicates: "${c.text_sample || 'similar file'}" → Classify as "${c.corrected_type}"`
    ).join('\n');
    fewShotBlock = `\n  LEARNING FROM OPERATOR CORRECTIONS:\n${examples}\n`;
  }

  const systemPrompt = `
  You are an expert Document Classification AI.
  Analyze the provided document text and classify it into EXACTLY ONE of the following categories:

  1. "Invoice": Select this if the document contains ANY bills, utility statements, electric bills, receipts, purchase orders, invoices, amount due, tax calculations, payment details, balance summaries, or transaction histories.
  2. "Drivers License": Select this if the document is a state driver license, DMV identity card, permit, identity document containing license numbers, DOB, expiration dates, or driver classes.
  3. "Passport": Select this if the document is a government travel passport booklet, containing passport numbers, MRZ codes (P<), or nationality details.
  4. "Resume": Select this for job applications, CVs, work experience, or career profiles.
  5. "Structured Form": Select this ONLY for general surveys, tax intake sheets (W-2), or medical intake applications. YOU MUST NOT select "Structured Form" if the document contains bills, utilities, receipts, amounts due, or driver identity cards.

  CRITICAL INSTRUCTIONS:
  - Return ONLY a valid JSON object with exact keys: "document_type" and "confidence".
  - The value of "document_type" MUST be exactly one of: "Invoice", "Drivers License", "Passport", "Resume", or "Structured Form".
  - Do NOT default to "Structured Form". Carefully check for financial terms (bills, totals, amounts) or identity terms (license, DOB) first.
  ${fewShotBlock}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Document Text:\n${rawText.slice(0, 25000)}` }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" }
    });

    let responseText = chatCompletion.choices[0]?.message?.content || '{}';
    responseText = responseText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();

    const result = JSON.parse(responseText);
    return {
      document_type: result.document_type || "Structured Form",
      confidence: result.confidence || 95
    };
  } catch (error) {
    console.error("LLM Classification failed, utilizing heuristics fallback:", error);
    let documentType = "Structured Form";
    const textLower = rawText.toLowerCase();
    if (textLower.includes("invoice") || textLower.includes("bill") || textLower.includes("amount due") || textLower.includes("total due") || textLower.includes("receipt") || textLower.includes("statement") || textLower.includes("balance") || textLower.includes("tax")) {
      documentType = "Invoice";
    } else if (textLower.includes("passport") || textLower.includes("p<") || textLower.includes("nationality") || textLower.includes("issuing authority")) {
      documentType = "Passport";
    } else if (textLower.includes("license") || textLower.includes("driver") || textLower.includes("dl") || textLower.includes("dmv") || textLower.includes("dob") || textLower.includes("class c") || textLower.includes("class a") || textLower.includes("id")) {
      documentType = "Drivers License";
    } else if (textLower.includes("resume") || textLower.includes("education") || textLower.includes("experience")) {
      documentType = "Resume";
    }
    return { document_type: documentType, confidence: 85 };
  }
}

module.exports = { extractStructuredData, classifyDocument };

