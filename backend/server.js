require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const documentRoutes = require('./routes/documentRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Ensure upload and output directories exist
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Routes
const auditRoutes = require('./routes/audit');
const { authenticate, requireRole } = require('./middleware/auth');

app.use('/api/documents', documentRoutes);
app.use('/api/audit', auditRoutes);

// Mock Configuration Endpoint restricted to Org_Admin and Developer
app.get('/api/config', authenticate, requireRole(['Org_Admin', 'Developer']), (req, res) => {
  res.json({
    message: 'Welcome to the Secure Configuration Area',
    api_keys: { groq: 'sk-groq-xxxxxx', tesseract: 'sk-tss-yyyyyy' },
    prompt_builder_status: 'Active'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
