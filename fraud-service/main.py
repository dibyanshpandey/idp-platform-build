from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import json

from forensics.metadata import analyze_metadata
from forensics.visual import analyze_visual
from forensics.logical import analyze_logical
from forensics.duplicate import analyze_duplicate
from forensics.incremental import analyze_incremental
from forensics.font_analysis import analyze_font
from forensics.vendor_profile import analyze_vendor_profile
from forensics.vdu import analyze_vdu

app = FastAPI(title="IDP Fraud Detection Service")

# Allow CORS for backend and frontend
# ... (lines 16-22 omitted for brevity, but I will keep them)

@app.post("/analyze")
async def analyze_document(
    document: UploadFile = File(...),
    extracted_data: str = Form("{}")
):
    """
    Runs the 8 forensic modules (including HF-based VDU) against the document.
    """
    file_bytes = await document.read()
    filename = document.filename
    
    try:
        parsed_json = json.loads(extracted_data)
    except:
        parsed_json = {}

    results = {}
    
    # 1. Metadata Forensics
    results["metadata"] = analyze_metadata(file_bytes, filename)
    
    # 2. Visual Forensics (Traditional)
    results["visual"] = analyze_visual(file_bytes, filename)
    
    # 3. Logical Validation
    results["logical"] = analyze_logical(parsed_json)
    
    # 4. Duplicate Detection
    results["duplicate"] = analyze_duplicate(file_bytes, filename)
    
    # 5. Incremental Update Detection
    results["incremental"] = analyze_incremental(file_bytes, filename)
    
    # 6. Font Anomaly Analysis
    results["font_analysis"] = analyze_font(file_bytes, filename)
    
    # 7. Cross-Document Vendor Profiling
    results["vendor_profile"] = analyze_vendor_profile(file_bytes, filename, parsed_json)
    
    # 8. Deep VDU Analysis (Hugging Face)
    results["vdu_analysis"] = analyze_vdu(file_bytes, filename)
    
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
