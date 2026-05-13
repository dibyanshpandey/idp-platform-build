import hashlib
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'hashes.db')

def _init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            hash TEXT PRIMARY KEY,
            filename TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn

def analyze_duplicate(file_bytes: bytes, filename: str) -> dict:
    """
    Computes SHA-256 and checks SQLite database for exact duplicates.
    Saves the hash if it is new.
    """
    try:
        conn = _init_db()
        cursor = conn.cursor()
        
        # Compute SHA-256
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        
        cursor.execute("SELECT filename FROM documents WHERE hash = ?", (sha256_hash,))
        result = cursor.fetchone()
        
        if result:
            conn.close()
            return {
                "status": "Fail",
                "reason": f"Exact duplicate detected. Previously uploaded as '{result[0]}'."
            }
            
        # Store new hash
        cursor.execute("INSERT INTO documents (hash, filename) VALUES (?, ?)", (sha256_hash, filename))
        conn.commit()
        conn.close()
        
        return {
            "status": "Pass",
            "reason": "Document hash is unique."
        }
    except Exception as e:
        return {
            "status": "Review",
            "reason": f"Duplicate detection failed: {str(e)}"
        }
