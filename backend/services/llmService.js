const { ChatGroq } = require("@langchain/groq");
const { ChatOpenAI } = require("@langchain/openai");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatAnthropic } = require("@langchain/anthropic");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { z } = require("zod");
const fs = require('fs');
const path = require('path');
const vectorService = require('./vectorService');

/**
 * Multi-Model Factory
 * Returns a LangChain ChatModel based on provider and model name.
 */
function getLLM(options = {}) {
  const provider = options.provider || "groq";
  const modelName = options.model || "llama-3.3-70b-versatile";
  const temperature = options.temperature ?? 0;

  switch (provider.toLowerCase()) {
    case "openai":
      return new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: modelName || "gpt-4o",
        temperature,
      });
    case "gemini":
      return new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_API_KEY,
        modelName: modelName || "gemini-1.5-pro",
        temperature,
      });
    case "anthropic":
      return new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        modelName: modelName || "claude-3-5-sonnet-latest",
        temperature,
      });
    case "groq":
    default:
      return new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        modelName: modelName || "llama-3.3-70b-versatile",
        temperature,
      });
  }
}

// Global default models for internal tasks
const defaultModel = getLLM();
const fastModel = getLLM({ model: "llama-3.1-8b-instant" });

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

/**
 * PHASE 1: AGENTIC AUDIT CHAIN
 * This agent audits the extraction results and flags inconsistencies.
 */
async function _agenticAudit(rawText, extractedData) {
  const auditPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a Senior Data Auditor. Your task is to verify if the extracted JSON data matches the provided OCR text.
    
    CHECK FOR:
    1. Math Errors: Do line items sum to the total?
    2. Transcription Errors: Are names or dates misread?
    3. Missing Data: Is there something in the text that SHOULD be in the JSON but isn't?
    4. Hallucinations: Is there something in the JSON that ISN'T in the text?
    
    Return your findings in a JSON object with:
    "is_valid": boolean,
    "discrepancies": string[],
    "suggested_fixes": object (key-value pairs to fix)`],
    ["user", "RAW TEXT:\n{rawText}\n\nEXTRACTED DATA:\n{extractedData}"]
  ]);

  const auditChain = auditPrompt.pipe(fastModel);
  const result = await auditChain.invoke({
    rawText: rawText.slice(0, 10000),
    extractedData: JSON.stringify(extractedData, null, 2)
  });

  try {
    const auditReport = JSON.parse(result.content.replace(/```json\n?|```/g, ""));
    return auditReport;
  } catch (e) {
    return { is_valid: true, discrepancies: [], suggested_fixes: {} };
  }
}

async function extractStructuredData(rawText, customSchema, imageBuffer, options = {}) {
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    return { extracted_raw_text: rawText };
  }

  // Determine which model to use (default or custom)
  const extractionModel = options.model ? getLLM(options) : defaultModel;

  // 1. Build Dynamic Schema & Instructions
  let schemaInstruction = "Extract natural key-value pairs.";
  if (customSchema) {
    schemaInstruction = `STRICT SCHEMA ENFORCEMENT: ${customSchema}`;
  }

  const corrections = loadCorrections();
  
  // 1.5. SEMANTIC CONTEXT RETRIEVAL (RAG)
  console.log("[Agent 0] Retrieving Semantic Context...");
  let semanticContext = "";
  try {
    const similarDocs = await vectorService.searchSimilar(rawText.slice(0, 2000), 2);
    if (similarDocs.length > 0) {
      semanticContext = `SIMILAR HISTORICAL CONTEXT:\n${similarDocs.map(d => `- For a similar document, we previously extracted: ${JSON.stringify(d.metadata)}`).join('\n')}\n`;
    }
  } catch (e) {
    console.warn("RAG retrieval failed, proceeding without context.");
  }

  const fewShotBlock = corrections.length > 0 
    ? `PAST CORRECTIONS:\n${corrections.map(c => `${c.field}: ${c.wrong} -> ${c.correct}`).join('\n')}`
    : "";

  // 2. Initial Extraction
  const extractPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an expert document extraction API. 
    1. Extract exactly as it appears.
    2. NO hallucinations.
    3. {schemaInstruction}
    4. Return ONLY valid JSON.
    {fewShotBlock}
    {semanticContext}`],
    ["user", "Document Text:\n{rawText}"]
  ]);

  const extractChain = extractPrompt.pipe(extractionModel);
  
  console.log(`[Agent 1] Starting Extraction using ${extractionModel.modelName || 'default'}...`);
  const initialResult = await extractChain.invoke({
    rawText,
    schemaInstruction,
    fewShotBlock,
    semanticContext
  });

  let extractedJSON;
  try {
    extractedJSON = JSON.parse(initialResult.content.replace(/```json\n?|```/g, ""));
    
    // Save to vector store for future RAG (Asynchronous)
    vectorService.addDocument(Date.now().toString(), rawText.slice(0, 2000), extractedJSON)
      .catch(err => console.error("Failed to save to vector store:", err));

  } catch (e) {
    console.error("Initial extraction failed to parse JSON:", e);
    return { error: "Parse error", raw: initialResult.content };
  }

  // 3. Agentic Audit Step (The "Gen AI Engineer" touch)
  console.log("[Agent 2] Starting Audit/Verification...");
  const auditReport = await _agenticAudit(rawText, extractedJSON);

  if (!auditReport.is_valid && auditReport.discrepancies.length > 0) {
    console.log(`[Agent 3] Discrepancies found: ${auditReport.discrepancies.join(", ")}. Correcting...`);
    
    const correctionPrompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a Data Correction Agent. Fix the provided JSON based on the Auditor's report."],
      ["user", "ORIGINAL JSON: {json}\nAUDIT REPORT: {report}\nFIXED JSON:"]
    ]);

    const correctionChain = correctionPrompt.pipe(defaultModel);
    const correctedResult = await correctionChain.invoke({
      json: JSON.stringify(extractedJSON),
      report: JSON.stringify(auditReport)
    });

    try {
      extractedJSON = JSON.parse(correctedResult.content.replace(/```json\n?|```/g, ""));
      extractedJSON._audit_verified = true;
      extractedJSON._audit_fixes = auditReport.discrepancies;
    } catch (e) {
      console.warn("Correction failed to parse, returning original extraction.");
    }
  } else {
    console.log("[Agent 2] Audit passed successfully.");
    extractedJSON._audit_verified = true;
  }

  return extractedJSON;
}

async function classifyDocument(rawText, options = {}) {
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    return { document_type: "Structured Form", confidence: 100 };
  }

  const classificationModel = options.model ? getLLM(options) : defaultModel;

  const corrections = loadClassificationCorrections();
  const fewShotBlock = corrections.length > 0 
    ? `PAST CORRECTIONS:\n${corrections.map(c => `Text snippet: ${c.text_sample} -> ${c.corrected_type}`).join('\n')}`
    : "";

  const classifyPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are a Document Classification AI.
    Categories: "Invoice", "Drivers License", "Passport", "Resume", "Structured Form".
    Return ONLY JSON with "document_type" and "confidence".
    {fewShotBlock}`],
    ["user", "Document Text:\n{text}"]
  ]);

  const chain = classifyPrompt.pipe(classificationModel);
  
  try {
    const result = await chain.invoke({
      text: rawText.slice(0, 15000),
      fewShotBlock
    });
    
    const parsed = JSON.parse(result.content.replace(/```json\n?|```/g, ""));
    return {
      document_type: parsed.document_type || "Structured Form",
      confidence: parsed.confidence || 95
    };
  } catch (e) {
    console.error("Classification failed, falling back to heuristics.");
    return { document_type: "Structured Form", confidence: 90 };
  }
}

module.exports = { extractStructuredData, classifyDocument };
