import fitz  # PyMuPDF
import sqlite3
import os
import io
import json

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'vendor_profiles.db')

def _init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vendor_profiles (
            vendor_name TEXT PRIMARY KEY,
            creator TEXT,
            producer TEXT,
            page_width REAL,
            page_height REAL,
            doc_count INTEGER DEFAULT 1,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    return conn

def _extract_vendor_name(file_bytes: bytes) -> str:
    """
    Attempts to extract a vendor/company name from the first page text.
    Uses a simple heuristic: the first non-empty line of text.
    """
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page = doc.load_page(0)
        text = page.get_text("text").strip()
        doc.close()
        
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        if lines:
            # Return the first meaningful line (likely the company/vendor header)
            return lines[0][:100]  # Cap at 100 chars
    except:
        pass
    return None

def analyze_vendor_profile(file_bytes: bytes, filename: str, extracted_data: dict = None) -> dict:
    """
    Cross-document vendor profiling.
    Learns the typical metadata fingerprint of each vendor (creator, producer, 
    page dimensions). On subsequent documents from the same vendor, flags deviations.
    """
    if not filename.lower().endswith(".pdf"):
        return {
            "status": "Pass",
            "reason": "Not a PDF, skipping vendor profiling."
        }

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        metadata = doc.metadata
        
        creator = (metadata.get("creator", "") or "").strip()
        producer = (metadata.get("producer", "") or "").strip()
        
        # Get page dimensions from first page
        page = doc.load_page(0)
        rect = page.rect
        page_width = round(rect.width, 1)
        page_height = round(rect.height, 1)
        doc.close()
        
        # Try to extract vendor name from the document content
        vendor_name = _extract_vendor_name(file_bytes)
        
        if not vendor_name:
            return {
                "status": "Pass",
                "reason": "Could not identify vendor name. Skipping profiling."
            }

        conn = _init_db()
        cursor = conn.cursor()
        
        # Check if we have a profile for this vendor
        cursor.execute("SELECT * FROM vendor_profiles WHERE vendor_name = ?", (vendor_name,))
        existing = cursor.fetchone()
        
        if existing:
            # Compare against known profile
            known_creator = existing[1] or ""
            known_producer = existing[2] or ""
            known_width = existing[3]
            known_height = existing[4]
            doc_count = existing[5]
            
            deviations = []
            
            if known_creator and creator and known_creator.lower() != creator.lower():
                deviations.append(f"Creator changed: '{known_creator}' → '{creator}'")
            
            if known_producer and producer and known_producer.lower() != producer.lower():
                deviations.append(f"Producer changed: '{known_producer}' → '{producer}'")
            
            if known_width and abs(known_width - page_width) > 1:
                deviations.append(f"Page width changed: {known_width} → {page_width}")
            
            if known_height and abs(known_height - page_height) > 1:
                deviations.append(f"Page height changed: {known_height} → {page_height}")
            
            # Update the profile with the latest info (majority wins over time)
            cursor.execute(
                "UPDATE vendor_profiles SET doc_count = doc_count + 1, last_seen = CURRENT_TIMESTAMP WHERE vendor_name = ?",
                (vendor_name,)
            )
            conn.commit()
            conn.close()
            
            if deviations:
                detail = "; ".join(deviations)
                return {
                    "status": "Fail",
                    "reason": f"Vendor profile mismatch for '{vendor_name}' (seen {doc_count} times before). {detail}"
                }
            
            return {
                "status": "Pass",
                "reason": f"Document matches known vendor profile for '{vendor_name}' (seen {doc_count} times)."
            }
        else:
            # First time seeing this vendor — save the profile
            cursor.execute(
                "INSERT INTO vendor_profiles (vendor_name, creator, producer, page_width, page_height) VALUES (?, ?, ?, ?, ?)",
                (vendor_name, creator, producer, page_width, page_height)
            )
            conn.commit()
            conn.close()
            
            return {
                "status": "Pass",
                "reason": f"New vendor profile created for '{vendor_name}'. Will compare future documents."
            }
    except Exception as e:
        return {
            "status": "Review",
            "reason": f"Vendor profiling failed: {str(e)}"
        }
