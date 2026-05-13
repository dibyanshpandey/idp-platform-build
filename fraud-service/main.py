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

app = FastAPI(title="IDP Fraud Detection Service")

# Allow CORS for backend and frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_document(
    document: UploadFile = File(...),
    extracted_data: str = Form("{}")
):
    """
    Runs the 7 forensic modules against the uploaded document and extracted JSON.
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
    
    # 2. Visual Forensics
    results["visual"] = analyze_visual(file_bytes, filename)
    
    # 3. Logical Validation
    results["logical"] = analyze_logical(parsed_json)
    
    # 4. Duplicate Detection
    results["duplicate"] = analyze_duplicate(file_bytes, filename)
    
    # 5. Incremental Update Detection (Deep Forensics)
    results["incremental"] = analyze_incremental(file_bytes, filename)
    
    # 6. Font Anomaly Analysis (Deep Forensics)
    results["font_analysis"] = analyze_font(file_bytes, filename)
    
    # 7. Cross-Document Vendor Profiling (Deep Forensics)
    results["vendor_profile"] = analyze_vendor_profile(file_bytes, filename, parsed_json)
    
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
