const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

// All audit routes require authentication
router.use(authenticate);

// Endpoint for Indexers (or any user) to log manual field modifications
router.post('/', requireRole(['Org_Admin', 'Developer', 'Indexer']), async (req, res) => {
  const { document_name, field_key, original_value, new_value } = req.body;
  const user_id = req.user.id;

  if (!document_name || !field_key) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await db.query(
      `INSERT INTO audit_ledger 
       (user_id, document_name, field_key, original_value, new_value) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [user_id, document_name, field_key, original_value, new_value]
    );

    res.status(201).json({ 
      message: 'Audit log recorded successfully', 
      log: result.rows[0] 
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
    res.status(500).json({ error: 'Database error while logging audit' });
  }
});

// Endpoint to fetch audit logs (Restricted to Org_Admin and Developer)
router.get('/', requireRole(['Org_Admin', 'Developer']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.username, u.role 
      FROM audit_ledger a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.timestamp DESC
      LIMIT 100
    `);
    
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
