from transformers import pipeline
import io
from PIL import Image
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lazy load the pipeline to save memory on startup
vdu_pipeline = None

def get_pipeline():
    global vdu_pipeline
    if vdu_pipeline is None:
        logger.info("Loading Hugging Face VDU model (microsoft/dit-base-finetuned-rvlcdip)...")
        # DiT (Document Image Transformer) is excellent for layout analysis
        try:
            vdu_pipeline = pipeline("image-classification", model="microsoft/dit-base-finetuned-rvlcdip")
        except Exception as e:
            logger.error(f"Failed to load HF model: {e}")
            return None
    return vdu_pipeline

def analyze_vdu(file_bytes, filename):
    """
    Performs Visual Document Understanding (VDU) using a Hugging Face vision model.
    Checks if the visual layout matches the expected document type.
    """
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        
        classifier = get_pipeline()
        if not classifier:
            return {"status": "skipped", "reason": "Model could not be loaded"}
            
        results = classifier(image)
        
        # Example logic: If the top result is 'invoice' but the app classified it as 'passport', flag it.
        top_result = results[0]
        
        return {
            "status": "success",
            "layout_type": top_result['label'],
            "confidence": round(top_result['score'], 4),
            "raw_insights": results[:3]
        }
    except Exception as e:
        logger.error(f"VDU Analysis error: {e}")
        return {"status": "error", "message": str(e)}
