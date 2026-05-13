const db = require('../db');

// Mock Authentication Middleware
// In a real app, this would verify a JWT token.
// Here we extract a simple user ID from headers.
async function authenticate(req, res, next) {
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing user ID' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }
    
    // Attach user to request
    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

// Role-Based Access Control Middleware
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Forbidden: No role assigned' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden: Access Denied for role ' + req.user.role 
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};
