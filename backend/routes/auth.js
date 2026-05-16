const express = require('express');
const db = require('../db');
const router = express.Router();

/**
 * POST /api/auth/register
 * Creates a new user in the system.
 */
router.post('/register', async (req, res) => {
  const { username, role } = req.body;

  if (!username || !role) {
    return res.status(400).json({ error: 'Username and role are required' });
  }

  const validRoles = ['Org_Admin', 'Developer', 'Indexer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  try {
    const result = await db.query(
      'INSERT INTO users (username, role) VALUES ($1, $2) RETURNING id, username, role',
      [username, role]
    );
    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

module.exports = router;
