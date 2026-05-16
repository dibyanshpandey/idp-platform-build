const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { processDocument } = require('../services/ocrService');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB limit
});

router.post('/upload', authenticate, upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No document uploaded' });
  }

  const userId = req.user.id;
  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const mimeType = req.file.mimetype;
  const fileSize = req.file.size;

  try {
    // 1. Insert initial "processing" record
    const insertResult = await db.query(
      `INSERT INTO documents (user_id, original_name, mime_type, file_path, file_size, status) 
       VALUES ($1, $2, $3, $4, $5, 'processing') RETURNING *`,
      [userId, originalName, mimeType, filePath, fileSize]
    );
    const documentRecord = insertResult.rows[0];

    // 2. Process document asynchronously (fire and forget for now, or await)
    // We will await it to simplify the flow and match previous behavior
    // 2. Process document asynchronously
    const customSchema = req.body.custom_schema;
    const llmOptions = {
      provider: req.body.provider,
      model: req.body.model
    };
    const result = await processDocument(filePath, mimeType, originalName, customSchema, llmOptions);

    // 3. Flatten structured data
    let mergedData = {};
    if (result.pages) {
      result.pages.forEach(page => {
         if(page.structuredData && !page.structuredData.error) {
            mergedData = { ...mergedData, ...page.structuredData };
         }
      });
    }

    // 4. Update the record
    const updateResult = await db.query(
      `UPDATE documents 
       SET status = 'needs_review', 
           extracted_data = $1, 
           fraud_analysis = $2, 
           document_type = $3,
           classification_confidence = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [
        JSON.stringify(mergedData), 
        JSON.stringify(result.fraudAnalysis || {}), 
        result.documentType || 'Structured Form', 
        result.classificationConfidence || 100, 
        documentRecord.id
      ]
    );
    
    const finalRecord = updateResult.rows[0];
    
    // Attach ocrPages to the response so the frontend still gets the bounding boxes
    // (We don't save ocrPages to DB because it's too large, but the frontend needs it on upload)
    res.json({
      ...finalRecord,
      ocrPages: result.pages
    });

  } catch (error) {
    console.error('Error processing document:', error);
    res.status(500).json({ error: 'Failed to process document', details: error.message });
  }
});

// GET user's document queue
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT id, original_name, mime_type, file_size, status, extracted_data, fraud_analysis, document_type, classification_confidence, created_at, updated_at 
       FROM documents 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents', details: error.message });
  }
});

// GET document binary file
router.get('/:id/file', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const documentId = req.params.id;
    
    const result = await db.query(
      `SELECT file_path, mime_type FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { file_path, mime_type } = result.rows[0];
    
    // Serve compliance watermarked PDF if it exists in the outputs folder
    if (mime_type === 'application/pdf') {
      const watermarkedPath = path.join(__dirname, '../outputs', `watermarked_${path.basename(file_path)}`);
      if (fs.existsSync(watermarkedPath)) {
        res.setHeader('Content-Type', mime_type);
        return fs.createReadStream(watermarkedPath).pipe(res);
      }
    }
    
    if (fs.existsSync(file_path)) {
      res.setHeader('Content-Type', mime_type);
      fs.createReadStream(file_path).pipe(res);
    } else {
      res.status(404).json({ error: 'File not found on disk' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch file', details: error.message });
  }
});

// PUT update document data and status
router.put('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const documentId = req.params.id;
    const { status, extracted_data, ocrPages } = req.body;
    
    // Ensure document belongs to user
    const checkResult = await db.query(`SELECT id, file_path FROM documents WHERE id = $1 AND user_id = $2`, [documentId, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { file_path } = checkResult.rows[0];

    // Synchronize updates back to compliance JSON file if it exists
    if (ocrPages && file_path) {
      try {
        const outputFileName = `${path.basename(file_path, path.extname(file_path))}.json`;
        const outputPath = path.join(__dirname, '../outputs', outputFileName);
        if (fs.existsSync(outputPath)) {
          const artifactData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
          artifactData.pages = ocrPages;
          fs.writeFileSync(outputPath, JSON.stringify(artifactData, null, 2));
        }
      } catch (jsonErr) {
        console.error('Failed to sync updated ocrPages with JSON output:', jsonErr.message);
      }
    }

    const updateResult = await db.query(
      `UPDATE documents 
       SET status = COALESCE($1, status), 
           extracted_data = COALESCE($2, extracted_data), 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [status, extracted_data ? JSON.stringify(extracted_data) : null, documentId]
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document', details: error.message });
  }
});

// GET document OCR pages structure (retrieves spatial coords & page-level metadata)
router.get('/:id/ocr', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const documentId = req.params.id;
    
    const result = await db.query(
      `SELECT file_path FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = result.rows[0].file_path;
    const outputFileName = `${path.basename(filePath, path.extname(filePath))}.json`;
    const outputPath = path.join(__dirname, '../outputs', outputFileName);
    
    if (fs.existsSync(outputPath)) {
      const artifactData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      res.json({ ocrPages: artifactData.pages || [] });
    } else {
      res.json({ ocrPages: [] });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch OCR pages', details: error.message });
  }
});

// POST update document classification (and record for continuous learning)
router.post('/:id/classify', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const documentId = req.params.id;
    const { document_type } = req.body;

    if (!document_type) {
      return res.status(400).json({ error: 'Missing document_type in body' });
    }

    // Ensure document belongs to user
    const checkResult = await db.query(
      `SELECT id, original_name, file_path, document_type FROM documents WHERE id = $1 AND user_id = $2`, 
      [documentId, userId]
    );
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const docRow = checkResult.rows[0];
    const originalType = docRow.document_type || 'Unclassified Document';

    // Update document type and set classification confidence to 100
    const updateResult = await db.query(
      `UPDATE documents 
       SET document_type = $1, 
           classification_confidence = 100,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [document_type, documentId]
    );

    // Continuous Learning: extract a raw text sample from the processed JSON file if it exists
    let textSample = '';
    try {
      const outputFileName = `${path.basename(docRow.file_path, path.extname(docRow.file_path))}.json`;
      const outputPath = path.join(__dirname, '../outputs', outputFileName);
      if (fs.existsSync(outputPath)) {
        const artifactData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        if (artifactData.pages && artifactData.pages.length > 0) {
          textSample = artifactData.pages.map(p => p.extractedText || '').join(' ').slice(0, 300);
        }
      }
    } catch (readErr) {
      console.warn('Failed to read text sample for classification correction:', readErr.message);
    }

    if (!textSample) {
      textSample = `File: ${docRow.original_name}`;
    }

    // Append to classification corrections file
    const correctionsPath = path.join(__dirname, '../data/classification_corrections.json');
    let corrections = [];
    try {
      if (fs.existsSync(correctionsPath)) {
        corrections = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));
      }
    } catch (e) {
      corrections = [];
    }

    corrections.push({
      original_type: originalType,
      corrected_type: document_type,
      text_sample: textSample,
      timestamp: new Date().toISOString()
    });

    // Keep only the last 50 classification corrections to prevent file bloat
    if (corrections.length > 50) {
      corrections = corrections.slice(-50);
    }

    fs.writeFileSync(correctionsPath, JSON.stringify(corrections, null, 2));

    res.json({ 
      message: 'Document classification updated and saved to AI learning registry', 
      document: updateResult.rows[0] 
    });

  } catch (error) {
    console.error('Failed to update document classification:', error);
    res.status(500).json({ error: 'Failed to update document classification', details: error.message });
  }
});

// Continuous Learning: Store operator corrections as few-shot examples
router.post('/correction', (req, res) => {
  try {
    const { document_type, field, wrong, correct } = req.body;
    if (!field || !correct) {
      return res.status(400).json({ error: 'Missing required fields: field, correct' });
    }

    const correctionsPath = path.join(__dirname, '../data/corrections.json');
    let corrections = [];
    try {
      corrections = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));
    } catch (e) {
      // File doesn't exist or is empty
      corrections = [];
    }

    corrections.push({
      document_type: document_type || 'Unknown',
      field,
      wrong: wrong || '',
      correct,
      timestamp: new Date().toISOString()
    });

    // Keep only the last 50 corrections to prevent file bloat
    if (corrections.length > 50) {
      corrections = corrections.slice(-50);
    }

    fs.writeFileSync(correctionsPath, JSON.stringify(corrections, null, 2));
    res.json({ message: 'Correction recorded', total: corrections.length });
  } catch (error) {
    console.error('Failed to save correction:', error);
    res.status(500).json({ error: 'Failed to save correction' });
  }
});

// Webhook Proxy: Forward validated data to an external system
router.post('/webhook', async (req, res) => {
  try {
    const { webhook_url, payload } = req.body;
    if (!webhook_url || !payload) {
      return res.status(400).json({ error: 'Missing webhook_url or payload' });
    }

    const response = await axios.post(webhook_url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    res.json({ 
      message: 'Webhook delivered successfully', 
      status: response.status,
      response: response.data 
    });
  } catch (error) {
    console.error('Webhook delivery failed:', error.message);
    res.status(502).json({ 
      error: 'Webhook delivery failed', 
      details: error.message 
    });
  }
});

// DELETE single document (file and DB record)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const documentId = req.params.id;

    // Fetch file path to delete from disk
    const result = await db.query(
      `SELECT file_path FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = result.rows[0].file_path;

    // Delete row from DB
    await db.query(`DELETE FROM documents WHERE id = $1 AND user_id = $2`, [documentId, userId]);

    // Delete file from disk if it exists
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to delete physical file: ${filePath}`, err);
      }
    }

    res.json({ message: 'Document deleted successfully', id: documentId });
  } catch (error) {
    console.error('Failed to delete document:', error);
    res.status(500).json({ error: 'Failed to delete document', details: error.message });
  }
});

// POST bulk delete documents (files and DB records)
router.post('/bulk-delete', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty list of IDs provided' });
    }

    // Fetch file paths of all matching documents
    const result = await db.query(
      `SELECT id, file_path FROM documents WHERE id = ANY($1) AND user_id = $2`,
      [ids, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No matching documents found' });
    }

    const foundIds = result.rows.map(r => r.id);
    const filePaths = result.rows.map(r => r.file_path);

    // Delete rows from DB
    await db.query(
      `DELETE FROM documents WHERE id = ANY($1) AND user_id = $2`,
      [foundIds, userId]
    );

    // Clean up physical files
    filePaths.forEach(filePath => {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to delete physical file in bulk: ${filePath}`, err);
        }
      }
    });

    res.json({ message: 'Documents deleted successfully', count: foundIds.length });
  } catch (error) {
    console.error('Failed to bulk delete documents:', error);
    res.status(500).json({ error: 'Failed to bulk delete documents', details: error.message });
  }
});

module.exports = router;
