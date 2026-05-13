import fitz  # PyMuPDF
import io

def analyze_metadata(file_bytes: bytes, filename: str) -> dict:
    """
    Checks PDF metadata for suspicious creator or producer software.
    Also briefly checks for hidden text layers (as a mock/simplified approach).
    """
    # Only process PDFs
    if not filename.lower().endswith(".pdf"):
        return {
            "status": "Pass",
            "reason": "Not a PDF, skipping PDF metadata analysis."
        }

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        metadata = doc.metadata
        
        suspicious_keywords = ["photoshop", "illustrator", "gimp", "inkscape", "coreldraw", "imagemagick"]
        
        creator = metadata.get("creator", "").lower()
        producer = metadata.get("producer", "").lower()
        
        for kw in suspicious_keywords:
            if kw in creator or kw in producer:
                return {
                    "status": "Fail",
                    "reason": f"Suspicious software detected in metadata: {creator or producer}"
                }
                
        # Hidden text check
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text_dict = page.get_text("dict")
            for block in text_dict.get("blocks", []):
                if "lines" in block:
                    for line in block["lines"]:
                        for span in line.get("spans", []):
                            if span.get("color") == 16777215:  # 0xFFFFFF (White)
                                return {
                                    "status": "Fail",
                                    "reason": "Hidden text detected: White text on white background (OCR Spoofing)."
                                }
                                
        return {
            "status": "Pass",
            "reason": "No suspicious metadata or hidden text detected."
        }
    except Exception as e:
        return {
            "status": "Review",
            "reason": f"Failed to parse PDF metadata: {str(e)}"
        }
