import io

def analyze_incremental(file_bytes: bytes, filename: str) -> dict:
    """
    Detects PDF tampering by counting incremental update markers.
    A legitimate, untampered PDF has exactly one %%EOF marker.
    Multiple %%EOF markers indicate the file was re-saved or modified
    after its initial creation — a strong indicator of post-creation editing.
    """
    if not filename.lower().endswith(".pdf"):
        return {
            "status": "Pass",
            "reason": "Not a PDF, skipping incremental update analysis."
        }

    try:
        # Count %%EOF markers in the raw binary
        content = file_bytes.decode("latin-1")
        eof_count = content.count("%%EOF")
        startxref_count = content.count("startxref")

        if eof_count > 1:
            return {
                "status": "Fail",
                "reason": f"Document has been modified after creation. Found {eof_count} incremental updates (%%EOF markers). Expected exactly 1."
            }

        if startxref_count > 1:
            return {
                "status": "Fail",
                "reason": f"Multiple cross-reference tables detected ({startxref_count}). Document structure indicates post-creation edits."
            }

        return {
            "status": "Pass",
            "reason": f"PDF structure is clean. Single %%EOF marker found. No incremental updates detected."
        }
    except Exception as e:
        return {
            "status": "Review",
            "reason": f"Incremental update analysis failed: {str(e)}"
        }
