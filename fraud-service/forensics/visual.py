import cv2
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
import io
import fitz

def _get_image_from_bytes(file_bytes: bytes, filename: str) -> Image.Image:
    if filename.lower().endswith(".pdf"):
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page = doc.load_page(0)
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        return img
    else:
        return Image.open(io.BytesIO(file_bytes)).convert("RGB")

def analyze_visual(file_bytes: bytes, filename: str) -> dict:
    """
    Performs Error Level Analysis (ELA) and a basic Feature Matching (Copy-Move proxy).
    """
    try:
        img = _get_image_from_bytes(file_bytes, filename)
        
        # 1. Error Level Analysis (ELA)
        # Save at a known quality
        temp_io = io.BytesIO()
        img.save(temp_io, "JPEG", quality=90)
        temp_io.seek(0)
        resaved_img = Image.open(temp_io)
        
        # Calculate absolute difference
        ela_img = ImageChops.difference(img, resaved_img)
        extrema = ela_img.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        
        # Enhance for analysis
        scale = 255.0 / max_diff if max_diff != 0 else 1
        ela_img = ImageEnhance.Brightness(ela_img).enhance(scale)
        
        # Convert to numpy for thresholding
        ela_cv = np.array(ela_img)
        gray = cv2.cvtColor(ela_cv, cv2.COLOR_RGB2GRAY)
        
        # If variance is too high, it might indicate spliced regions (different compressions)
        variance = np.var(gray)
        if variance > 500: # Threshold lowered for higher sensitivity
            return {
                "status": "Fail",
                "reason": f"High ELA variance ({variance:.1f}) detected. Possible splicing."
            }

        # 2. SIFT Feature Matching (Basic Copy-Move simulation)
        # Convert original to cv2
        cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
        sift = cv2.SIFT_create()
        keypoints, descriptors = sift.detectAndCompute(cv_img, None)
        
        if descriptors is not None and len(keypoints) > 500:
            # We match descriptors against themselves to find identical regions
            # Exclude self-matches by distance
            bf = cv2.BFMatcher()
            matches = bf.knnMatch(descriptors, descriptors, k=2)
            
            good_matches = []
            for m, n in matches:
                if m.distance < 0.75 * n.distance:
                    # Filter out keypoints that are too close (same point)
                    pt1 = keypoints[m.queryIdx].pt
                    pt2 = keypoints[m.trainIdx].pt
                    dist = np.sqrt((pt1[0]-pt2[0])**2 + (pt1[1]-pt2[1])**2)
                    if dist > 50: # Arbitrary pixel distance
                        good_matches.append(m)
            
            if len(good_matches) > 20: # Arbitrary threshold for identical cloned features
                return {
                    "status": "Fail",
                    "reason": f"Copy-move detected: {len(good_matches)} cloned features found."
                }
        
        return {
            "status": "Pass",
            "reason": "Image integrity verified. No anomalies detected."
        }
    except Exception as e:
        return {
            "status": "Review",
            "reason": f"Visual analysis failed: {str(e)}"
        }
