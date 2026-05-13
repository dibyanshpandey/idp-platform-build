# 🛡️ Enterprise Intelligent Document Processing (IDP) Platform

An advanced, commercial SaaS-ready **Intelligent Document Processing (IDP)** platform. The system ingests multi-page PDFs/images, extracts structural & spatial metadata using a high-fidelity OCR engine merged with a Groq-powered Large Language Model (LLM), runs fraud/forensics verification, and secures manual validation workflows with Role-Based Access Control (RBAC) and an immutable Audit Ledger.

---

## 🏗️ System Architecture

The platform is designed as a modular, three-tier service architecture:

```mermaid
graph TD
    A[React/Vite Frontend] -->|API Requests| B[Node.js Backend API]
    B -->|Database Query| C[(PostgreSQL DB)]
    B -->|Forensics Analysis| D[Python Fraud Service]
    B -->|OCR & Spatial Bounds| E[Tesseract / LLM Extraction]
```

### 📦 Component Directory

1. **[React Frontend (`/frontend`)](file:///Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/frontend)**
   * Built with React, Vite, and custom CSS variables for premium visual styling (dark-mode aesthetic, sleek glassmorphism, responsive split-pane dashboards, and beautiful micro-animations).
   * Features a **Document Queue**, interactive **Validation Station** with spatial highlights, and interactive **Analytics Dashboard**.

2. **[Node.js Backend (`/backend`)](file:///Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/backend)**
   * Powering the primary ingestion, auth (RBAC), auditing, and document processing endpoints.
   * Leverages high-accuracy OCR coordinate merging, Groq-backed spatial structured extraction, and a PostgreSQL database.

3. **[Python Fraud Service (`/fraud-service`)](file:///Users/dibyanshpandey/Documents/Antigravity/idp-platform-build/fraud-service)**
   * A Python forensic engine analyzing documents for structural, logical, and visual tampering.
   * Performs signature mismatch, font anomalies, duplicate hashes, logical profile discrepancies, and metadata extraction tests.

---

## ⚡ Tech Stack

| Tier | Technologies Used |
| :--- | :--- |
| **Frontend** | React, Vite, CSS Variables (Custom Sleek Dark UI), PDF.js |
| **Backend** | Node.js, Express, PostgreSQL, Tesseract OCR, Groq LLM SDK, JWT Auth |
| **Fraud Service**| Python 3, PyPDF2, Pillow, SQLite (localized hashes & profiles) |

---

## 🚀 Getting Started

Follow these steps to run the complete platform locally:

### 1. Prerequisites
Ensure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v18+ recommended)
* [Python](https://www.python.org/) (3.9+ recommended)
* [PostgreSQL](https://www.postgresql.org/) database

---

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Configure your Environment Variables by creating a `.env` file:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/idp_database
   JWT_SECRET=your_super_secret_jwt_key
   GROQ_API_KEY=your_groq_api_key
   ```
4. Run the database seed/migration script to initialize RBAC roles and audit tables:
   ```bash
   npm run setup-db
   ```
5. Start the development API server:
   ```bash
   npm run dev
   ```

---

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Access the client application in your browser at `http://localhost:5173`.

---

### 4. Fraud Service Setup
1. Navigate to the fraud service directory:
   ```bash
   cd ../fraud-service
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the Python server:
   ```bash
   python main.py
   ```

---

## 🛡️ Key Features Included

* **OCR Spatial Highlighting**: Hover over extracted text on the Validation Station to visually highlight exactly where the text resides on the original document.
* **Role-Based Access Control (RBAC)**: Secure user roles (`Org_Admin`, `Developer`, `Indexer`) restricting edit/export capabilities.
* **Immutable Audit Logging**: Every manual field edit, correction, or verification action is permanently logged to an audit table including user information, timestamp, and previous vs. new values.
* **Forensic Verification**: Instant document metadata verification flagging visual modifications, template mismatched structures, and duplicate invoice runs.
